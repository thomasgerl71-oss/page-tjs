(function () {
  "use strict";

  // --------------------------------------------------------------------
  // Die Details-Tabelle (Preis, Bestellen, E-Book, Amazon …) auf den
  // Buch-Detailseiten wird aus einem Google Sheet geladen, damit sie ohne
  // Code-Änderung gepflegt werden kann. Einrichtung:
  //
  // 1. Google Sheet "TJS Details" mit den Spalten (erste Zeile = Überschrift):
  //    Titel | PREIS | BESTELLEN | E-Book | AMAZON …
  //    Pro Buch zwei Zeilen: Zeile 1 = Titel + Anzeigetexte,
  //    Zeile 2 = leere erste Spalte + die passenden Links (Preis ohne Link
  //    einfach leer lassen). Weitere Spalten können ergänzt werden, sie
  //    werden automatisch mit übernommen.
  //
  // 2. Oben rechts auf "Freigeben" > "Allgemeiner Zugriff" auf
  //    "Jeder, der über den Link verfügt" (Betrachter) stellen.
  //
  // 3. Auf der jeweiligen Buchseite trägt <dl data-book-title="…"> den
  //    Titel exakt so ein wie in der Spalte "Titel" im Sheet.
  // --------------------------------------------------------------------

  var SHEET_ID = "1pQ-9IWZOGNzR6ZVDJgX9BKGrYcb4HIc1fWkX1a0piMY";
  var GID = "0";

  var CSV_URL = SHEET_ID
    ? "https://docs.google.com/spreadsheets/d/" + SHEET_ID + "/export?format=csv&gid=" + GID
    : "";

  var listEl = document.querySelector("[data-book-title]");
  if (!listEl || !CSV_URL) {
    return;
  }

  function parseCsv(text) {
    var rows = [];
    var row = [];
    var field = "";
    var inQuotes = false;

    for (var i = 0; i < text.length; i++) {
      var ch = text[i];

      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += ch;
        }
        continue;
      }

      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(field);
        field = "";
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") {
          i++;
        }
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += ch;
      }
    }

    if (field.length > 0 || row.length > 0) {
      row.push(field);
      rows.push(row);
    }

    return rows.filter(function (r) {
      return r.some(function (cell) {
        return cell.trim() !== "";
      });
    });
  }

  // Sheet-Überschriften -> Anzeigetext im dt (Preis statt PREIS, …).
  var DISPLAY_NAME = {
    PREIS: "Preis",
    BESTELLEN: "Bestellen",
    AMAZON: "Amazon",
  };

  function displayName(name) {
    return DISPLAY_NAME[name] || name;
  }

  function formatLabel(fieldName, label) {
    if (fieldName === "PREIS") {
      return label.replace(/(\d)\s*€/, "$1 €");
    }
    return label;
  }

  function normalizeTitle(str) {
    return (str || "")
      .toLowerCase()
      .replace(/[^a-z0-9äöüß]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  // Jedes Buch belegt eine oder mehrere Zeilen: Zeile 1 (Spalte "Titel"
  // gefüllt) trägt die Anzeigetexte, alle direkt folgenden Zeilen mit
  // leerer Titel-Spalte liefern die dazugehörigen Links.
  function rowsToBooks(rows) {
    if (rows.length < 2) {
      return [];
    }

    var fieldNames = rows[0].slice(1).map(function (h) {
      return h.trim();
    });

    var books = [];
    var current = null;

    for (var i = 1; i < rows.length; i++) {
      var r = rows[i];
      var titel = (r[0] || "").trim();

      if (titel !== "") {
        current = { titel: titel, fields: {} };
        fieldNames.forEach(function (name, idx) {
          current.fields[name] = { label: (r[idx + 1] || "").trim(), href: "" };
        });
        books.push(current);
      } else if (current) {
        fieldNames.forEach(function (name, idx) {
          var val = (r[idx + 1] || "").trim();
          if (val) {
            current.fields[name].href = val;
          }
        });
      }
    }

    return books;
  }

  function render(book) {
    listEl.innerHTML = "";

    Object.keys(book.fields).forEach(function (name) {
      var field = book.fields[name];
      if (!field.label) {
        return;
      }

      var label = formatLabel(name, field.label);

      var row = document.createElement("div");

      var dt = document.createElement("dt");
      dt.textContent = displayName(name);
      row.appendChild(dt);

      var dd = document.createElement("dd");
      if (field.href) {
        var a = document.createElement("a");
        a.href = field.href;
        a.textContent = label;
        dd.appendChild(a);
      } else {
        dd.textContent = label;
      }
      row.appendChild(dd);

      listEl.appendChild(row);
    });
  }

  fetch(CSV_URL)
    .then(function (response) {
      if (!response.ok) {
        throw new Error("HTTP " + response.status);
      }
      return response.text();
    })
    .then(function (text) {
      var wanted = normalizeTitle(listEl.getAttribute("data-book-title"));
      var books = rowsToBooks(parseCsv(text));
      var match = books.filter(function (b) {
        return normalizeTitle(b.titel) === wanted;
      })[0];

      // Kein Treffer im Sheet: die im HTML hinterlegten Details bleiben
      // unverändert stehen (kein Datenverlust bei fehlenden Zeilen).
      if (match) {
        render(match);
      }
    })
    .catch(function () {
      // Sheet nicht erreichbar: die im HTML hinterlegten Details bleiben
      // als Fallback sichtbar.
    });
})();
