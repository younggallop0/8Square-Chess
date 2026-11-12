// Paste into Google Sheets > Extensions > Apps Script, then Deploy as Web app.
// Row 1 headers: Submitted At | Wallet Address | Tier | Referrer | SOL Balance

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var d = JSON.parse(e.postData.contents);
    var address = String(d.address || '').trim();
    var ref = String(d.ref || '').trim();
    var tier = d.tier === 'top' ? 'top' : 'standard';
    var b58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

    if (!b58.test(address)) return ContentService.createTextOutput('invalid');
    if (ref && (!b58.test(ref) || ref === address)) ref = '';

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    // One claim per wallet per tier: skip duplicates
    var last = sheet.getLastRow();
    if (last > 1) {
      var rows = sheet.getRange(2, 2, last - 1, 2).getValues(); // wallet, tier
      for (var i = 0; i < rows.length; i++) {
        if (rows[i][0] === address && rows[i][1] === tier) {
          return ContentService.createTextOutput('duplicate');
        }
      }
    }

    sheet.appendRow([new Date(), address, tier, ref, d.balance === null ? '' : d.balance]);
    return ContentService.createTextOutput('ok');
  } finally {
    lock.releaseLock();
  }
}
