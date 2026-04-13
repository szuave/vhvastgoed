(function() {
    if (localStorage.getItem('vh_cookie_consent')) return;

    var banner = document.createElement('div');
    banner.id = 'vh-cookie-banner';
    banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#111;color:#fff;padding:20px 5%;display:flex;align-items:center;justify-content:space-between;gap:20px;z-index:9999;font-family:Montserrat,sans-serif;font-size:0.85rem;line-height:1.6;box-shadow:0 -4px 20px rgba(0,0,0,0.3);flex-wrap:wrap;';

    var text = document.createElement('p');
    text.style.cssText = 'margin:0;flex:1;min-width:280px;';
    text.innerHTML = 'Wij gebruiken cookies om onze website goed te laten functioneren en te beveiligen, en om u de best mogelijke gebruikerservaring te bieden. Lees meer in ons <a href="privacybeleid.html" style="color:#BEA265;text-decoration:underline;">privacybeleid</a>.';

    var btns = document.createElement('div');
    btns.style.cssText = 'display:flex;gap:10px;flex-shrink:0;flex-wrap:wrap;';

    var acceptBtn = document.createElement('button');
    acceptBtn.textContent = 'Accepteren';
    acceptBtn.style.cssText = 'background:#BEA265;color:#fff;border:none;padding:10px 24px;font-family:Montserrat,sans-serif;font-size:0.78rem;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;cursor:pointer;transition:background 0.3s;';
    acceptBtn.onmouseover = function() { this.style.background = '#CCAF73'; };
    acceptBtn.onmouseout = function() { this.style.background = '#BEA265'; };
    acceptBtn.onclick = function() {
        localStorage.setItem('vh_cookie_consent', 'all');
        banner.parentNode.removeChild(banner);
    };

    var declineBtn = document.createElement('button');
    declineBtn.textContent = 'Alleen noodzakelijke';
    declineBtn.style.cssText = 'background:transparent;color:rgba(255,255,255,0.6);border:1px solid rgba(255,255,255,0.2);padding:10px 24px;font-family:Montserrat,sans-serif;font-size:0.78rem;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;cursor:pointer;transition:all 0.3s;';
    declineBtn.onmouseover = function() { this.style.color = '#fff'; this.style.borderColor = 'rgba(255,255,255,0.5)'; };
    declineBtn.onmouseout = function() { this.style.color = 'rgba(255,255,255,0.6)'; this.style.borderColor = 'rgba(255,255,255,0.2)'; };
    declineBtn.onclick = function() {
        localStorage.setItem('vh_cookie_consent', 'necessary');
        banner.parentNode.removeChild(banner);
    };

    btns.appendChild(acceptBtn);
    btns.appendChild(declineBtn);
    banner.appendChild(text);
    banner.appendChild(btns);
    document.body.appendChild(banner);
})();
