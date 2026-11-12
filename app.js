
/* =========================================================
   8Square Chess Airdrop Portal
   Shared EmailJS script for both pages
   ========================================================= */

(function () {
    'use strict';

    /* ---------- CONFIGURATION ---------- */

const EMAILJS_PUBLIC_KEY = "kMWj2xk6WsoeK0IAm";
    const SERVICE_ID = "service_axakgsj";
    const TEMPLATE_ID = "template_c6s5dck";

    const RPC_URL = "https://api.mainnet-beta.solana.com";
    const TOP_TIER_MIN_SOL = 200;
    const COOLDOWN_SECONDS = 8;
    const STORAGE_KEY = "8square_submissions";

    // Initialize EmailJS
    emailjs.init({
        publicKey: EMAILJS_PUBLIC_KEY
    });

    /* ---------- WALLET VALIDATION ---------- */

    const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

    /* ---------- REFERRAL URL ---------- */

    const params = new URLSearchParams(window.location.search);
    const refFromUrl = (params.get('ref') || '').trim();
    const baseUrl = window.location.href.split(/[?#]/)[0];

    if (refFromUrl && BASE58.test(refFromUrl)) {

        document.querySelectorAll('a[data-keepref]').forEach(function (a) {
            a.setAttribute(
                'href',
                a.getAttribute('href').split('?')[0] + '?ref=' + refFromUrl
            );
        });

    }

    /* ---------- STORAGE HELPERS ---------- */

    function getSaved() {

        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
        } catch (e) {
            return [];
        }

    }

    function save(entry) {

        try {
            const list = getSaved();
            list.push(entry);

            localStorage.setItem(STORAGE_KEY, JSON.stringify(list));

        } catch (e) {
            // Ignore storage errors
        }

    }

    /* ---------- SOLANA BALANCE CHECK ---------- */

    function getSolBalance(address) {

        const ctrl = new AbortController();

        const timer = setTimeout(function () {
            ctrl.abort();
        }, 9000);

        return fetch(RPC_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'getBalance',
                params: [address]
            }),
            signal: ctrl.signal

        })
        .then(function (r) {
            return r.json();
        })
        .then(function (j) {

            clearTimeout(timer);

            if (!j.result || typeof j.result.value !== 'number') {
                throw new Error('Bad RPC response');
            }

            return j.result.value / 1e9;

        })
        .catch(function (err) {

            clearTimeout(timer);
            throw err;

        });

    }

    /* ---------- EMAILJS SUBMISSION ---------- */

    function sendToServer(entry) {

        return emailjs.send(
            SERVICE_ID,
            TEMPLATE_ID,
            {
                wallet: entry.address,
                referral: entry.ref || "No referral"
            }
        );

    }

    /* ---------- CLAIM FORM ---------- */

    const form = document.querySelector('.claim-form');

    if (!form) return;

    const tier = form.getAttribute('data-tier');
    const card = form.parentNode;

    const walletEl = form.querySelector('.f-wallet');
    const refEl = form.querySelector('.f-ref');
    const errorEl = form.querySelector('.error');
    const btn = form.querySelector('.btn');

    const idleLabel = btn.textContent;

    const successEl = card.querySelector('.success');
    const linkEl = card.querySelector('.f-link');
    const copyBtn = card.querySelector('.f-copy');

    if (refFromUrl) {
        refEl.value = refFromUrl;
    }

    /* ---------- ERROR HANDLING ---------- */

    function setError(msg, el) {

        errorEl.textContent = msg;

        (el || walletEl).parentNode.classList.add('invalid');

    }

    function clearError() {

        errorEl.textContent = '';

        walletEl.parentNode.classList.remove('invalid');
        refEl.parentNode.classList.remove('invalid');

    }

    walletEl.addEventListener('input', clearError);
    refEl.addEventListener('input', clearError);

    /* ---------- SUBMISSION COOLDOWN ---------- */

    function cooldown() {

        let left = COOLDOWN_SECONDS;

        btn.disabled = true;
        btn.textContent = 'Submitted (' + left + 's)';

        const t = setInterval(function () {

            left--;

            if (left <= 0) {

                clearInterval(t);

                btn.disabled = false;
                btn.textContent = idleLabel;

            } else {

                btn.textContent = 'Submitted (' + left + 's)';

            }

        }, 1000);

    }

    /* ---------- COPY REFERRAL LINK ---------- */

    copyBtn.addEventListener('click', function () {

        function done() {

            copyBtn.textContent = 'Copied';

            setTimeout(function () {
                copyBtn.textContent = 'Copy';
            }, 1500);

        }

        if (navigator.clipboard && navigator.clipboard.writeText) {

            navigator.clipboard.writeText(linkEl.value).then(
                done,
                function () {

                    linkEl.select();
                    document.execCommand('copy');
                    done();

                }
            );

        } else {

            linkEl.select();
            document.execCommand('copy');
            done();

        }

    });

    /* ---------- FORM SUBMISSION ---------- */

    form.addEventListener('submit', function (e) {

        e.preventDefault();

        clearError();

        successEl.classList.remove('show');

        const address = walletEl.value.trim();
        const ref = refEl.value.trim();

        /* Validate wallet */

        if (!address) {

            setError('Please enter your Solana wallet address.');
            walletEl.focus();
            return;

        }

        if (!BASE58.test(address)) {

            setError('That doesn’t look like a valid Solana address. It should be 32–44 characters.');
            walletEl.focus();
            return;

        }

        if (ref && !BASE58.test(ref)) {

            setError('Referral must be a valid Solana wallet address.', refEl);
            refEl.focus();
            return;

        }

        if (ref && ref === address) {

            setError('You can’t use your own address as a referral.', refEl);
            refEl.focus();
            return;

        }

        /* Check duplicate submissions */

        const dup = getSaved().some(function (s) {

            return s.address === address && s.tier === tier;

        });

        if (dup) {

            setError('This wallet address has already been submitted.');
            return;

        }

        btn.disabled = true;

        /* Top Tier balance verification */

        let check = Promise.resolve(null);

        if (tier === 'top') {

            btn.textContent = 'Checking balance…';

            check = getSolBalance(address).then(function (sol) {

                if (sol < TOP_TIER_MIN_SOL) {

                    const err = new Error('low');
                    err.sol = sol;

                    throw err;

                }

                return sol;

            });

        } else {

            btn.textContent = 'Submitting…';

        }

        /* Send submission through EmailJS */

        check.then(function (sol) {

            btn.textContent = 'Submitting…';

            const entry = {

                tier: tier,
                address: address,
                ref: ref,
                balance: sol,
                submittedAt: new Date().toISOString()

            };

            return sendToServer(entry).then(function () {

                save(entry);

            });

        })

        /* Successful submission */

        .then(function () {

            walletEl.value = '';

            linkEl.value = baseUrl + '?ref=' + address;

            void successEl.offsetWidth;

            successEl.classList.add('show');

            cooldown();

        })

        /* Submission errors */

        .catch(function (err) {

            console.error('Submission Error:', err);

            btn.disabled = false;
            btn.textContent = idleLabel;

            if (err && err.message === 'low') {

                setError(
                    'This wallet holds ' + err.sol.toFixed(2) +
                    ' SOL. Top Tier requires at least ' +
                    TOP_TIER_MIN_SOL +
                    ' SOL. You can still claim in the standard airdrop.'
                );

            } else if (tier === 'top' && err && err.message !== 'low') {

                setError(
                    'Couldn’t verify your balance or submit your claim. Please try again.'
                );

            } else {

                setError(
                    'Network error. Please try again.'
                );

            }

        });

    });

})();
