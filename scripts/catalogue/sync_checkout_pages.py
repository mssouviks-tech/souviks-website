#!/usr/bin/env python3
"""Generate the first-party purchase cart and Cashfree payment-status pages."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LANGUAGES = ("en", "hi", "bn")

TEXT = {
    "en": {
        "cart_title": "Your Cart | Souviks", "cart_heading": "Shopping Cart",
        "description": "Review commercial vehicle spare parts and complete a secure online checkout with Souviks.",
        "lead": "Review the products and quantities before checkout. Your final amount, including configured shipping, is confirmed securely before you continue to payment.",
        "breadcrumb": "Shopping Cart", "items": "Your items",
        "empty": "Your cart is empty. Browse our catalogue and add priced products to start an order.",
        "browse": "Browse products", "summary": "Order summary", "subtotal": "Items subtotal",
        "shipping": "Shipping", "total": "Order total", "shipping_calc": "Confirmed before payment",
        "total_calc": "Review to calculate",
        "hint": "The final total is calculated on the server using current catalogue prices and the configured shipping policy.",
        "note": "Online checkout is for domestic Indian deliveries at present. If checkout is unavailable for an item or order, please use Request a Quote.",
        "contact": "Customer details", "full_name": "Full name", "email": "Email (optional)",
        "phone": "Mobile number", "company": "Company (optional)", "gst": "GSTIN (optional)",
        "delivery": "Delivery details", "address1": "Address line 1", "address2": "Address line 2 (optional)",
        "city": "City", "state": "State", "pin": "PIN code",
        "terms": "I agree to the Terms & Conditions, Privacy Policy and Refund Policy.",
        "review": "Review total & continue", "review_title": "Review your order total",
        "review_explain": "Check this exact amount before opening Cashfree's secure payment page.",
        "order_ref": "Order reference", "lines_subtotal": "Items subtotal", "shipping_fee": "Shipping",
        "amount_due": "Amount payable", "pay": "Continue to secure payment",
        "status_title": "Payment status", "status_label": "Payment status", "status_loading": "Checking your payment with Cashfree…",
        "amount": "Amount", "retry": "Retry verification", "back": "Continue shopping",
        "help": "Need help? Contact us at", "terms_link": "Terms & Conditions", "privacy_link": "Privacy Policy", "refund_link": "Refund Policy",
    },
    "hi": {
        "cart_title": "आपका कार्ट | Souviks", "cart_heading": "शॉपिंग कार्ट",
        "description": "कमर्शियल वाहन स्पेयर पार्ट्स की जाँच करें और Souviks के साथ सुरक्षित ऑनलाइन चेकआउट पूरा करें।",
        "lead": "चेकआउट से पहले उत्पाद और मात्रा जाँचें। भुगतान पर आगे बढ़ने से पहले कॉन्फ़िगर की गई शिपिंग सहित अंतिम राशि की पुष्टि की जाएगी।",
        "breadcrumb": "शॉपिंग कार्ट", "items": "आपके उत्पाद",
        "empty": "आपका कार्ट खाली है। ऑर्डर शुरू करने के लिए कैटलॉग से मूल्य वाले उत्पाद जोड़ें।",
        "browse": "उत्पाद देखें", "summary": "ऑर्डर सारांश", "subtotal": "उत्पादों का उप-योग",
        "shipping": "शिपिंग", "total": "ऑर्डर का कुल", "shipping_calc": "भुगतान से पहले पुष्टि होगी",
        "total_calc": "गणना के लिए समीक्षा करें",
        "hint": "सटीक राशि सर्वर पर वर्तमान कैटलॉग कीमतों और कॉन्फ़िगर की गई शिपिंग नीति से निकाली जाती है।",
        "note": "फिलहाल ऑनलाइन चेकआउट केवल भारत के भीतर डिलीवरी के लिए है। यदि किसी उत्पाद या ऑर्डर के लिए चेकआउट उपलब्ध नहीं है, तो कृपया कोटेशन माँगें।",
        "contact": "ग्राहक विवरण", "full_name": "पूरा नाम", "email": "ईमेल (वैकल्पिक)",
        "phone": "मोबाइल नंबर", "company": "कंपनी (वैकल्पिक)", "gst": "GSTIN (वैकल्पिक)",
        "delivery": "डिलीवरी विवरण", "address1": "पता पंक्ति 1", "address2": "पता पंक्ति 2 (वैकल्पिक)",
        "city": "शहर", "state": "राज्य", "pin": "पिन कोड",
        "terms": "मैं नियम और शर्तें, गोपनीयता नीति और रिफंड नीति स्वीकार करता/करती हूँ।",
        "review": "कुल राशि जाँचें और आगे बढ़ें", "review_title": "ऑर्डर की कुल राशि जाँचें",
        "review_explain": "Cashfree के सुरक्षित भुगतान पेज पर जाने से पहले इस राशि की पुष्टि करें।",
        "order_ref": "ऑर्डर संदर्भ", "lines_subtotal": "उत्पादों का उप-योग", "shipping_fee": "शिपिंग",
        "amount_due": "देय राशि", "pay": "सुरक्षित भुगतान पर आगे बढ़ें",
        "status_title": "भुगतान स्थिति", "status_label": "भुगतान स्थिति", "status_loading": "Cashfree से भुगतान की पुष्टि हो रही है…",
        "amount": "राशि", "retry": "पुष्टि फिर जाँचें", "back": "खरीदारी जारी रखें",
        "help": "सहायता चाहिए? संपर्क करें", "terms_link": "नियम और शर्तें", "privacy_link": "गोपनीयता नीति", "refund_link": "रिफंड नीति",
    },
    "bn": {
        "cart_title": "আপনার কার্ট | Souviks", "cart_heading": "শপিং কার্ট",
        "description": "কমার্শিয়াল ভেহিকল স্পেয়ার পার্টস যাচাই করে Souviks-এর মাধ্যমে নিরাপদ অনলাইন চেকআউট সম্পন্ন করুন।",
        "lead": "চেকআউটের আগে পণ্য ও পরিমাণ যাচাই করুন। পেমেন্টে যাওয়ার আগে নির্ধারিত শিপিং-সহ চূড়ান্ত মূল্য নিশ্চিত করা হবে।",
        "breadcrumb": "শপিং কার্ট", "items": "আপনার পণ্য",
        "empty": "আপনার কার্ট খালি। অর্ডার শুরু করতে ক্যাটালগ থেকে মূল্যযুক্ত পণ্য যোগ করুন।",
        "browse": "পণ্য দেখুন", "summary": "অর্ডারের সারাংশ", "subtotal": "পণ্যের উপমোট",
        "shipping": "শিপিং", "total": "মোট অর্ডার মূল্য", "shipping_calc": "পেমেন্টের আগে নিশ্চিত হবে",
        "total_calc": "মূল্য যাচাই করুন",
        "hint": "বর্তমান ক্যাটালগ মূল্য এবং নির্ধারিত শিপিং নীতি ব্যবহার করে সার্ভারে চূড়ান্ত মূল্য গণনা করা হয়।",
        "note": "এই পর্যায়ে অনলাইন চেকআউট শুধুমাত্র ভারতের মধ্যে ডেলিভারির জন্য। কোনো পণ্য বা অর্ডারে চেকআউট উপলব্ধ না হলে কোটেশন চাইুন।",
        "contact": "গ্রাহকের বিবরণ", "full_name": "পুরো নাম", "email": "ইমেল (ঐচ্ছিক)",
        "phone": "মোবাইল নম্বর", "company": "কোম্পানি (ঐচ্ছিক)", "gst": "GSTIN (ঐচ্ছিক)",
        "delivery": "ডেলিভারির বিবরণ", "address1": "ঠিকানা লাইন ১", "address2": "ঠিকানা লাইন ২ (ঐচ্ছিক)",
        "city": "শহর", "state": "রাজ্য", "pin": "পিন কোড",
        "terms": "আমি শর্তাবলী, গোপনীয়তা নীতি এবং রিফান্ড নীতি মেনে নিচ্ছি।",
        "review": "মোট মূল্য যাচাই করে এগিয়ে যান", "review_title": "অর্ডারের মোট মূল্য যাচাই করুন",
        "review_explain": "Cashfree-এর নিরাপদ পেমেন্ট পেজে যাওয়ার আগে এই নির্দিষ্ট মূল্য যাচাই করুন।",
        "order_ref": "অর্ডার রেফারেন্স", "lines_subtotal": "পণ্যের উপমোট", "shipping_fee": "শিপিং",
        "amount_due": "পরিশোধযোগ্য", "pay": "নিরাপদ পেমেন্টে এগিয়ে যান",
        "status_title": "পেমেন্টের অবস্থা", "status_label": "পেমেন্টের অবস্থা", "status_loading": "Cashfree থেকে পেমেন্ট যাচাই হচ্ছে…",
        "amount": "পরিমাণ", "retry": "আবার যাচাই করুন", "back": "কেনাকাটা চালিয়ে যান",
        "help": "সাহায্য দরকার? যোগাযোগ করুন", "terms_link": "শর্তাবলী", "privacy_link": "গোপনীয়তা নীতি", "refund_link": "রিফান্ড নীতি",
    },
}

CART_TEMPLATE = """<!doctype html>
<html lang="__LANG__">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#d62828">
  <meta name="robots" content="noindex,nofollow">
  <title>__CART_TITLE__</title>
  <meta name="description" content="__DESCRIPTION__">
  <link rel="canonical" href="https://www.souviks.co.in/__LANG__/cart">
  <link rel="alternate" hreflang="en" href="https://www.souviks.co.in/en/cart">
  <link rel="alternate" hreflang="bn" href="https://www.souviks.co.in/bn/cart">
  <link rel="alternate" hreflang="hi" href="https://www.souviks.co.in/hi/cart">
  <link rel="alternate" hreflang="x-default" href="https://www.souviks.co.in/en/cart">
  <link rel="icon" type="image/png" href="/assets/favicon/favicon-32x32.png">
  <link rel="apple-touch-icon" href="/assets/favicon/apple-touch-icon.png">
  <link rel="stylesheet" href="/assets/css/site-base.css">
  <link rel="stylesheet" href="/assets/css/bundles/cart.css">
</head>
<body class="site-page page-cart">
  <div class="top-bar"><div class="container">
    <div class="top-bar-brand"><a href="/__LANG__/" class="top-logo"><img src="/assets/logo/souviks-logo.webp?v=a5300f9e16e9" width="1024" height="1024" alt="Souviks"></a></div>
    <div class="top-bar-tools">
      <a href="mailto:info@souviks.co.in" class="top-item top-email"><img src="/assets/icons/email.svg" class="top-icon" width="24" height="24" alt=""> info@souviks.co.in</a>
      <a href="tel:+919434331896" class="top-item top-phone"><img src="/assets/icons/phone.svg" class="top-icon" width="24" height="24" alt=""> +91 94343 31896</a>
      <a href="https://wa.me/+917908215701" class="top-item top-whatsapp" target="_blank" rel="noopener noreferrer"><img src="/assets/icons/whatsapp.svg" class="top-icon" width="24" height="24" alt=""> WhatsApp</a>
      <div id="topAuth" class="top-auth"><a id="topSignIn" href="/__LANG__/login" class="top-signin" data-auth-open="login">Sign In</a><div id="topUserMenu" class="top-user-menu" hidden><button type="button" id="topUserButton" class="top-user-button" aria-expanded="false" aria-haspopup="true"><span id="topUserName">Account</span></button><div id="topUserDropdown" class="top-user-dropdown" hidden><a href="/__LANG__/account">My Account</a><button type="button" data-auth-logout>Sign Out</button></div></div></div>
    </div>
    <button id="mobileMenuButton" class="mobile-menu-button" type="button" aria-label="Open Navigation" aria-expanded="false" aria-controls="mainNavigation"><span></span><span></span><span></span></button>
  </div></div>
  <header class="site-header"><div class="container"><div class="header-wrapper">
    <nav id="mainNavigation" class="main-navigation" aria-label="Primary Navigation">
      <div class="mobile-navigation-header"><img src="/assets/logo/souviks-logo-white.webp?v=a5300f9e16e9" alt="Souviks" class="mobile-navigation-logo" width="1024" height="1024"><button id="mobileNavigationClose" class="mobile-navigation-close" type="button" aria-label="Close Navigation">×</button></div>
      <ul class="navigation-menu"></ul>
      <div class="mobile-nav-auth" aria-label="Account"><a id="mobileNavSignIn" class="mobile-nav-auth-link" href="/__LANG__/login">Sign In</a><div id="mobileNavUserMenu" class="mobile-nav-user" hidden><a class="mobile-nav-auth-link" href="/__LANG__/account"><span aria-hidden="true">◉</span><span id="mobileNavUserName">Account</span></a><button type="button" id="mobileNavSignOut" class="mobile-nav-auth-link mobile-nav-signout" data-auth-logout>Sign Out</button></div></div>
    </nav>
    <div class="header-buttons"><a href="/__LANG__/request-part" class="btn btn-primary">Request a Part</a><a href="/__LANG__/request-quote" class="btn btn-secondary">RFQ Basket <span class="rfq-badge">0</span></a></div>
  </div></div></header>
  <main id="main-content" class="container purchase-cart-page">
    <nav class="breadcrumb" aria-label="Breadcrumb"><div class="container"><ol class="breadcrumb-list"><li class="breadcrumb-item"><a href="/__LANG__/">Home</a></li><li class="breadcrumb-item active" aria-current="page">__BREADCRUMB__</li></ol></div></nav>
    <section class="purchase-cart-heading"><h1>__HEADING__</h1><p>__LEAD__</p></section>
    <div id="purchase-cart-root">
      <div id="purchase-cart-status" class="form-status purchase-cart-status" role="status" aria-live="polite" hidden></div>
      <div id="purchase-cart-empty" class="purchase-cart-empty" hidden>__EMPTY__<br><a href="/__LANG__/products">__BROWSE__</a></div>
      <div id="purchase-cart-layout" class="purchase-cart-layout" hidden>
        <section class="purchase-cart-panel" aria-labelledby="purchase-cart-items-heading"><h2 id="purchase-cart-items-heading">__ITEMS__</h2><div id="purchase-cart-items" class="purchase-cart-items"></div></section>
        <aside class="purchase-cart-summary" aria-labelledby="purchase-cart-summary-heading">
          <h2 id="purchase-cart-summary-heading">__SUMMARY__</h2>
          <dl><div><dt>__SUBTOTAL__</dt><dd id="purchase-cart-subtotal">₹0.00</dd></div><div><dt>__SHIPPING__</dt><dd id="purchase-cart-shipping">__SHIPPING_CALC__</dd></div><div class="purchase-cart-grand-total"><dt>__TOTAL__</dt><dd id="purchase-cart-total">__TOTAL_CALC__</dd></div></dl>
          <p class="purchase-cart-help">__HINT__</p><p class="purchase-cart-help">__NOTE__</p>
          <form id="purchase-checkout-form" class="purchase-checkout-form">
            <h3>__CONTACT__</h3>
            <div class="form-group"><label for="checkout-name">__FULL_NAME__</label><input type="text" id="checkout-name" name="name" autocomplete="name" maxlength="100" required></div>
            <div class="form-group"><label for="checkout-email">__EMAIL__</label><input type="email" id="checkout-email" name="email" autocomplete="email" maxlength="254"></div>
            <div class="form-group"><label for="checkout-phone">__PHONE__</label><input type="tel" id="checkout-phone" name="phone" autocomplete="tel-national" inputmode="numeric" pattern="[0-9]{10}" minlength="10" maxlength="10" placeholder="10-digit mobile number" required></div>
            <div class="form-group"><label for="checkout-company">__COMPANY__</label><input type="text" id="checkout-company" name="company" autocomplete="organization" maxlength="160"></div>
            <div class="form-group"><label for="checkout-gst">__GST__</label><input type="text" id="checkout-gst" name="gst_number" maxlength="15" autocapitalize="characters"></div>
            <h3>__DELIVERY__</h3>
            <div class="purchase-address-grid">
              <div class="form-group form-group-full"><label for="checkout-address1">__ADDRESS1__</label><input type="text" id="checkout-address1" name="address1" autocomplete="address-line1" maxlength="180" required></div>
              <div class="form-group form-group-full"><label for="checkout-address2">__ADDRESS2__</label><input type="text" id="checkout-address2" name="address2" autocomplete="address-line2" maxlength="120"></div>
              <div class="form-group"><label for="checkout-city">__CITY__</label><input type="text" id="checkout-city" name="city" autocomplete="address-level2" maxlength="100" required></div>
              <div class="form-group"><label for="checkout-state">__STATE__</label><input type="text" id="checkout-state" name="state" autocomplete="address-level1" maxlength="100" required></div>
              <div class="form-group"><label for="checkout-pincode">__PIN__</label><input type="text" id="checkout-pincode" name="postal_code" autocomplete="postal-code" inputmode="numeric" pattern="[0-9]{6}" minlength="6" maxlength="6" required></div>
            </div>
            <label class="purchase-terms"><input type="checkbox" id="checkout-terms" name="terms_accepted" required><span>__TERMS__ <a href="/__LANG__/terms">__TERMS_LINK__</a> · <a href="/__LANG__/privacy-policy">__PRIVACY_LINK__</a> · <a href="/__LANG__/refund">__REFUND_LINK__</a></span></label>
            <button id="purchase-review-button" type="submit" class="btn btn-primary">__REVIEW__</button>
          </form>
          <section id="purchase-payment-review" class="purchase-payment-review" aria-live="polite" hidden>
            <h3>__REVIEW_TITLE__</h3><p>__REVIEW_EXPLAIN__</p>
            <dl><div><dt>__ORDER_REF__</dt><dd id="checkout-review-order-number">—</dd></div><div><dt>__LINES_SUBTOTAL__</dt><dd id="checkout-review-subtotal">—</dd></div><div><dt>__SHIPPING_FEE__</dt><dd id="checkout-review-shipping">—</dd></div><div class="purchase-review-total"><dt>__AMOUNT_DUE__</dt><dd id="checkout-review-total">—</dd></div></dl>
            <button id="purchase-pay-button" type="button" class="btn btn-primary">__PAY__</button>
          </section>
        </aside>
      </div>
    </div>
  </main>
  <footer class="site-footer"><div class="container"><p>© Souviks · <a href="/__LANG__/terms">Terms &amp; Conditions</a> · <a href="/__LANG__/privacy-policy">Privacy Policy</a> · <a href="/__LANG__/refund">Refund Policy</a></p></div></footer>
  <script>
    window.souviks = {
      siteName: "Souviks",
      siteUrl: "https://www.souviks.co.in",
      currentPage: "__CONFIG_PAGE__",
      currentPageType: "",
      currentPageUrl: "/__LANG__/cart",
      breadcrumbRoot: false,
      currentLanguage: "__LANG__",
      translations: {
        buttons: { add_to_rfq: "Add To RFQ" },
        navigation: { home: "Home", products: "Products", brands: "Brands", vehicles: "Vehicles", categories: "Categories" }
      },
      api: {
        products: "/assets/data/products.json",
        brands: "/assets/data/brands.json",
        categories: "/assets/data/categories.json",
        vehicles: "/assets/data/vehicles.json",
        search: "/assets/data/search.json"
      }
    };
  </script>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script src="https://sdk.cashfree.com/js/v3/cashfree.js"></script>
  <script defer src="/assets/js/site-core.js"></script>
  <script defer src="/assets/js/attribution.js"></script>
  <script defer src="/assets/js/cart/cart.js"></script>
</body>
</html>
"""

STATUS_TEMPLATE = """<!doctype html>
<html lang="__LANG__">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#d62828"><meta name="robots" content="noindex,nofollow">
  <title>__STATUS_TITLE__ | Souviks</title>
  <meta name="description" content="Verify your Souviks online order payment status.">
  <link rel="canonical" href="https://www.souviks.co.in/__LANG__/payment-status">
  <link rel="alternate" hreflang="en" href="https://www.souviks.co.in/en/payment-status">
  <link rel="alternate" hreflang="bn" href="https://www.souviks.co.in/bn/payment-status">
  <link rel="alternate" hreflang="hi" href="https://www.souviks.co.in/hi/payment-status">
  <link rel="alternate" hreflang="x-default" href="https://www.souviks.co.in/en/payment-status">
  <link rel="icon" type="image/png" href="/assets/favicon/favicon-32x32.png">
  <link rel="apple-touch-icon" href="/assets/favicon/apple-touch-icon.png">
  <link rel="stylesheet" href="/assets/css/site-base.css"><link rel="stylesheet" href="/assets/css/bundles/cart.css">
</head>
<body class="site-page page-payment-status">
  <div class="top-bar"><div class="container">
    <div class="top-bar-brand"><a href="/__LANG__/" class="top-logo"><img src="/assets/logo/souviks-logo.webp?v=a5300f9e16e9" width="1024" height="1024" alt="Souviks"></a></div>
    <div class="top-bar-tools"><a href="mailto:info@souviks.co.in" class="top-item top-email">info@souviks.co.in</a><a href="tel:+919434331896" class="top-item top-phone">+91 94343 31896</a><div id="topAuth" class="top-auth"><a id="topSignIn" href="/__LANG__/login" class="top-signin" data-auth-open="login">Sign In</a><div id="topUserMenu" class="top-user-menu" hidden><button type="button" id="topUserButton" class="top-user-button" aria-expanded="false"><span id="topUserName">Account</span></button></div></div></div>
    <button id="mobileMenuButton" class="mobile-menu-button" type="button" aria-label="Open Navigation" aria-expanded="false" aria-controls="mainNavigation"><span></span><span></span><span></span></button>
  </div></div>
  <header class="site-header"><div class="container"><div class="header-wrapper">
    <nav id="mainNavigation" class="main-navigation" aria-label="Primary Navigation"><div class="mobile-navigation-header"><img src="/assets/logo/souviks-logo-white.webp?v=a5300f9e16e9" alt="Souviks" class="mobile-navigation-logo" width="1024" height="1024"><button id="mobileNavigationClose" class="mobile-navigation-close" type="button" aria-label="Close Navigation">×</button></div><ul class="navigation-menu"></ul><div class="mobile-nav-auth" aria-label="Account"><a id="mobileNavSignIn" class="mobile-nav-auth-link" href="/__LANG__/login">Sign In</a><div id="mobileNavUserMenu" class="mobile-nav-user" hidden><a class="mobile-nav-auth-link" href="/__LANG__/account"><span id="mobileNavUserName">Account</span></a><button type="button" id="mobileNavSignOut" class="mobile-nav-auth-link mobile-nav-signout" data-auth-logout>Sign Out</button></div></div></nav>
    <div class="header-buttons"><a href="/__LANG__/cart" class="btn btn-secondary">Shopping Cart</a><a href="/__LANG__/request-quote" class="btn btn-secondary">RFQ Basket <span class="rfq-badge">0</span></a></div>
  </div></div></header>
  <main id="main-content" class="container payment-status-page">
    <nav class="breadcrumb" aria-label="Breadcrumb"><div class="container"><ol class="breadcrumb-list"><li class="breadcrumb-item"><a href="/__LANG__/">Home</a></li><li class="breadcrumb-item"><a href="/__LANG__/cart">Cart</a></li><li class="breadcrumb-item active" aria-current="page">__STATUS_LABEL__</li></ol></div></nav>
    <section id="payment-status-root" class="payment-status-panel">
      <h1>__STATUS_TITLE__</h1><p id="payment-status-message" role="status" aria-live="polite">__STATUS_LOADING__</p>
      <dl><div><dt>__ORDER_REF__</dt><dd id="payment-status-reference" class="payment-status-reference">—</dd></div><div><dt>__AMOUNT__</dt><dd id="payment-status-detail" class="payment-status-detail">—</dd></div></dl>
      <button id="payment-status-retry" type="button" class="btn btn-secondary" hidden>__RETRY__</button>
      <p><a href="/__LANG__/products">__BACK_PRODUCTS__</a></p>
      <p>__HELP__ <a href="mailto:info@souviks.co.in">info@souviks.co.in</a> · <a href="tel:+919434331896">+91 94343 31896</a></p>
    </section>
  </main>
  <footer class="site-footer"><div class="container"><p>© Souviks · <a href="/__LANG__/terms">Terms &amp; Conditions</a> · <a href="/__LANG__/privacy-policy">Privacy Policy</a> · <a href="/__LANG__/refund">Refund Policy</a></p></div></footer>
  <script>
    window.souviks = {
      siteName: "Souviks",
      siteUrl: "https://www.souviks.co.in",
      currentPage: "__CONFIG_PAGE__",
      currentPageType: "",
      currentPageUrl: "/__LANG__/payment-status",
      breadcrumbRoot: false,
      currentLanguage: "__LANG__",
      translations: {
        buttons: { add_to_rfq: "Add To RFQ" },
        navigation: { home: "Home", products: "Products", brands: "Brands", vehicles: "Vehicles", categories: "Categories" }
      },
      api: {
        products: "/assets/data/products.json",
        brands: "/assets/data/brands.json",
        categories: "/assets/data/categories.json",
        vehicles: "/assets/data/vehicles.json",
        search: "/assets/data/search.json"
      }
    };
  </script>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script><script defer src="/assets/js/site-core.js"></script><script defer src="/assets/js/attribution.js"></script><script defer src="/assets/js/cart/cart.js"></script>
</body>
</html>
"""

def render(template: str, lang: str, values: dict[str, str]) -> str:
    result = template.replace("__LANG__", lang)
    for key, value in values.items():
        result = result.replace("__" + key.upper() + "__", value)
    return result


def main() -> int:
    changed = 0
    for lang in LANGUAGES:
        labels = TEXT[lang]
        values = {
            "cart_title": labels["cart_title"],
            "config_page": labels["cart_heading"],
            "description": labels["description"],
            "breadcrumb": labels["breadcrumb"],
            "heading": labels["cart_heading"],
            "lead": labels["lead"],
            "empty": labels["empty"],
            "browse": labels["browse"],
            "items": labels["items"],
            "summary": labels["summary"],
            "subtotal": labels["subtotal"],
            "shipping": labels["shipping"],
            "shipping_calc": labels["shipping_calc"],
            "total": labels["total"],
            "total_calc": labels["total_calc"],
            "hint": labels["hint"],
            "note": labels["note"],
            "contact": labels["contact"],
            "full_name": labels["full_name"],
            "email": labels["email"],
            "phone": labels["phone"],
            "company": labels["company"],
            "gst": labels["gst"],
            "delivery": labels["delivery"],
            "address1": labels["address1"],
            "address2": labels["address2"],
            "city": labels["city"],
            "state": labels["state"],
            "pin": labels["pin"],
            "terms": labels["terms"],
            "terms_link": labels["terms_link"],
            "privacy_link": labels["privacy_link"],
            "refund_link": labels["refund_link"],
            "review": labels["review"],
            "review_title": labels["review_title"],
            "review_explain": labels["review_explain"],
            "order_ref": labels["order_ref"],
            "lines_subtotal": labels["lines_subtotal"],
            "shipping_fee": labels["shipping_fee"],
            "amount_due": labels["amount_due"],
            "pay": labels["pay"],
        }
        pages = (
            (ROOT / lang / "cart.html", render(CART_TEMPLATE, lang, values)),
            (ROOT / lang / "payment-status.html", render(STATUS_TEMPLATE, lang, {
                "status_title": labels["status_title"],
                "config_page": labels["status_title"],
                "status_label": labels["status_label"],
                "status_loading": labels["status_loading"],
                "order_ref": labels["order_ref"],
                "amount": labels["amount"],
                "retry": labels["retry"],
                "back_products": labels["back"],
                "help": labels["help"],
            })),
        )
        for path, content in pages:
            if not path.parent.is_dir():
                raise FileNotFoundError("Missing language directory: " + str(path.parent))
            normalized = content.strip() + "\n"
            if not path.is_file() or path.read_text(encoding="utf-8") != normalized:
                path.write_text(normalized, encoding="utf-8")
                changed += 1
    print("Checkout pages synchronized: " + str(changed) + " files updated.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
