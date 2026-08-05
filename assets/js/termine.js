(function () {
  "use strict";

  // --------------------------------------------------------------------
  // Termine werden aus einem Google Sheet geladen, damit Termine ohne
  // Code-Änderung gepflegt werden können. Einrichtung:
  //
  // 1. Google Sheet anlegen mit den Spalten (erste Zeile = Überschrift):
  //    Datum | Uhrzeit | Titel | Ort | Link
  //    Datum im Format TT.MM.JJJJ, z. B. 17.11.2026
  //    Link ist optional (leer lassen, wenn kein Link vorhanden ist).
  //
  // 2. Oben rechts auf "Freigeben" > "Allgemeiner Zugriff" auf
  //    "Jeder, der über den Link verfügt" (Betrachter) stellen.
  //
  // 3. Aus der Adressleiste die Sheet-ID kopieren:
  //    https://docs.google.com/spreadsheets/d/SHEET_ID_HIER/edit#gid=GID_HIER
  //
  // 4. SHEET_ID und GID unten eintragen.
  // --------------------------------------------------------------------

  var SHEET_ID = "1k_I0v08gjOYlwMeEbLtzLnobtOCIHSg0ROjcGl3-rnI";
  var GID = "0";

  var CSV_URL = SHEET_ID
    ? "https://docs.google.com/spreadsheets/d/" + SHEET_ID + "/export?format=csv&gid=" + GID
    : "";

  var listEl = document.getElementById("termine-list");
  if (!listEl) {
    return;
  }

  function setStatus(message) {
    listEl.innerHTML = "";
    var p = document.createElement("p");
    p.className = "termine-status";
    p.textContent = message;
    listEl.appendChild(p);
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

  function normalizeHeader(header) {
    return header.trim().toLowerCase();
  }

  function rowsToEvents(rows) {
    if (rows.length < 2) {
      return [];
    }

    var headers = rows[0].map(normalizeHeader);
    var col = {
      datum: headers.indexOf("datum"),
      uhrzeit: headers.indexOf("uhrzeit"),
      titel: headers.indexOf("titel"),
      ort: headers.indexOf("ort"),
      link: headers.indexOf("link"),
    };

    return rows.slice(1).map(function (r) {
      return {
        datum: col.datum > -1 ? (r[col.datum] || "").trim() : "",
        uhrzeit: col.uhrzeit > -1 ? (r[col.uhrzeit] || "").trim() : "",
        titel: col.titel > -1 ? (r[col.titel] || "").trim() : "",
        ort: col.ort > -1 ? (r[col.ort] || "").trim() : "",
        link: col.link > -1 ? (r[col.link] || "").trim() : "",
      };
    }).filter(function (ev) {
      return ev.datum !== "" && ev.titel !== "";
    });
  }

  function parseGermanDate(datum) {
    var parts = datum.split(".");
    if (parts.length !== 3) {
      return null;
    }
    var day = parseInt(parts[0], 10);
    var month = parseInt(parts[1], 10);
    var year = parseInt(parts[2], 10);
    if (!day || !month || !year) {
      return null;
    }
    return new Date(year, month - 1, day);
  }

  function render(events) {
    var today = new Date();
    today.setHours(0, 0, 0, 0);

    var upcoming = events
      .map(function (ev) {
        return { ev: ev, date: parseGermanDate(ev.datum) };
      })
      .filter(function (item) {
        return item.date && item.date >= today;
      })
      .sort(function (a, b) {
        return a.date - b.date;
      });

    if (upcoming.length === 0) {
      setStatus("Aktuell sind keine Termine geplant. Schauen Sie bald wieder vorbei!");
      return;
    }

    listEl.innerHTML = "";

    upcoming.forEach(function (item) {
      var ev = item.ev;

      var article = document.createElement("article");
      article.className = "termine-item";

      var dateWrap = document.createElement("div");
      dateWrap.className = "termine-item__date";

      var day = document.createElement("span");
      day.className = "termine-item__day";
      day.textContent = ev.datum;
      dateWrap.appendChild(day);

      if (ev.uhrzeit) {
        var time = document.createElement("span");
        time.className = "termine-item__time";
        time.textContent = ev.uhrzeit + " Uhr";
        dateWrap.appendChild(time);
      }

      var body = document.createElement("div");
      body.className = "termine-item__body";

      var title = document.createElement("h2");
      title.textContent = ev.titel;
      body.appendChild(title);

      if (ev.ort) {
        var location = document.createElement("p");
        location.className = "termine-item__location";
        location.textContent = ev.ort;
        body.appendChild(location);
      }

      if (ev.link) {
        var link = document.createElement("a");
        link.className = "termine-item__link";
        link.href = ev.link;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "Mehr Infos →";
        body.appendChild(link);
      }

      article.appendChild(dateWrap);
      article.appendChild(body);
      listEl.appendChild(article);
    });
  }

  if (!CSV_URL) {
    setStatus("Termine sind noch nicht eingerichtet (Google-Sheet-ID fehlt in assets/js/termine.js).");
    return;
  }

  fetch(CSV_URL)
    .then(function (response) {
      if (!response.ok) {
        throw new Error("HTTP " + response.status);
      }
      return response.text();
    })
    .then(function (text) {
      render(rowsToEvents(parseCsv(text)));
    })
    .catch(function () {
      setStatus("Termine konnten gerade nicht geladen werden. Bitte versuchen Sie es später erneut.");
    });
})();
