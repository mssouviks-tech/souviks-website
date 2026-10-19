(()=>{"use strict";const originalError=typeof console?.error=="function"?console.error.bind(console):null,originalWarn=typeof console?.warn=="function"?console.warn.bind(console):null;function safeString(value){return String(value??"").replace(/https?:\/\/\S+/gi,"[url]").replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g,"[email]").replace(/[A-Za-z0-9_-]{32,}/g,"[redacted]")}function sanitiseError(error){const source=error instanceof Error?error:null,name=source?.name||error&&typeof error=="object"&&error.name||"Error",status=Number(source?.status??error?.status),code=safeString(source?.code??error?.code??"");return{name:safeString(name).slice(0,48),...Number.isInteger(status)&&status>=100&&status<=599?{status}:{},...code?{code:code.slice(0,48)}:{}}}function log(context,error,level="error"){const label=safeString(context||"Runtime error").slice(0,120),details=sanitiseError(error),logger=level==="warn"?originalWarn:originalError;logger&&logger("[Souviks]",label,details)}function showGlobalFailure(){if(!document.body||document.getElementById("souviks-runtime-error"))return;const alert=document.createElement("div");alert.id="souviks-runtime-error",alert.setAttribute("role","alert"),alert.textContent="Something went wrong. Please refresh the page and try again.",Object.assign(alert.style,{position:"fixed",left:"12px",right:"12px",bottom:"12px",zIndex:"10000",padding:"12px 16px",borderRadius:"10px",background:"#243042",color:"#fff",fontSize:"14px",lineHeight:"1.4",boxShadow:"0 8px 30px rgba(0,0,0,.18)"}),document.body.appendChild(alert)}window.SouviksErrors={log,sanitise:sanitiseError},window.addEventListener("error",event=>{log("Unhandled browser error",event?.error||{name:"Error"}),window.setTimeout(showGlobalFailure,0)}),window.addEventListener("unhandledrejection",event=>{log("Unhandled promise rejection",event?.reason||{name:"Error"}),event?.preventDefault?.(),window.setTimeout(showGlobalFailure,0)})})(),(()=>{"use strict";const GA_MEASUREMENT_ID="G-FDLYP5QB8V";function ensureGoogleAnalytics(){window.dataLayer=window.dataLayer||[],window.gtag=window.gtag||function(){window.dataLayer.push(arguments)},window.gtag("js",new Date),window.gtag("config",GA_MEASUREMENT_ID);const hasScript=()=>Array.from(document.scripts||[]).some(script=>String(script.src||"").includes("googletagmanager.com/gtag/js?id="+GA_MEASUREMENT_ID));if(hasScript())return;const loadScript=()=>{if(hasScript())return;const script=document.createElement("script");script.async=!0,script.src="https://www.googletagmanager.com/gtag/js?id="+encodeURIComponent(GA_MEASUREMENT_ID),document.head.appendChild(script)},schedule=()=>{"requestIdleCallback"in window?window.requestIdleCallback(loadScript,{timeout:8e3}):window.setTimeout(loadScript,1500)};document.readyState==="complete"?schedule():window.addEventListener("load",schedule,{once:!0})}ensureGoogleAnalytics();const analyticsApi=window.souviksAnalytics||{};analyticsApi.trackEvent=function(name,params={}){try{window.gtag("event",String(name||"event"),{...params,page_location:window.location.href,page_title:document.title})}catch{}},analyticsApi.trackSearch=function(query,resultCount,source="search"){const payload={query:String(query||"").trim().slice(0,160),resultCount:Number(resultCount)||0,source:String(source||"search"),timestamp:new Date().toISOString()};try{window.dispatchEvent(new CustomEvent("souviks:search",{detail:payload}))}catch{}if(payload.query)try{window.gtag("event","search",{search_term:payload.query,results_count:payload.resultCount,search_source:payload.source,page_location:window.location.href,page_title:document.title})}catch{}},analyticsApi.trackLead=function(type="lead",params={}){try{window.gtag("event","generate_lead",{lead_type:String(type||"lead"),...params,page_location:window.location.href,page_title:document.title})}catch{}},window.souviksAnalytics=analyticsApi;function bindConversionClickTracking(){window.__SOUVIKS_ANALYTICS_CLICKS_BOUND__||(window.__SOUVIKS_ANALYTICS_CLICKS_BOUND__=!0,document.addEventListener("click",event=>{const target=event.target instanceof Element?event.target.closest("a, button"):null;if(!target)return;(target.matches(".add-to-cart, .pdp-rfq-btn")||target.closest(".add-to-cart, .pdp-rfq-btn"))&&window.souviksAnalytics?.trackEvent("rfq_click",{product_id:target.dataset.id||target.closest("[data-id]")?.dataset.id||"",part_number:target.dataset.part||target.closest("[data-part]")?.dataset.part||""});const requestPart=target.closest('a[href*="/request-part"]');requestPart&&window.souviksAnalytics?.trackEvent("request_part_click",{link_text:String(requestPart.textContent||"").trim().slice(0,120)});const whatsapp=target.closest('a[href*="wa.me"]');whatsapp&&window.souviksAnalytics?.trackEvent("whatsapp_click",{link_location:String(whatsapp.className||whatsapp.getAttribute("aria-label")||"whatsapp").slice(0,160)});const phone=target.closest('a[href^="tel:"]');phone&&window.souviksAnalytics?.trackEvent("phone_click",{link_location:String(phone.className||phone.getAttribute("aria-label")||"phone").slice(0,160)});const email=target.closest('a[href^="mailto:"]');email&&window.souviksAnalytics?.trackEvent("email_click",{link_location:String(email.className||email.getAttribute("aria-label")||"email").slice(0,160)})},!0))}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",bindConversionClickTracking,{once:!0}):bindConversionClickTracking()})(),(()=>{"use strict";function ensureSkipLink(){const main=document.querySelector("main:not(.souviks-loader)");if(!main||(main.id||(main.id="main-content"),main.tabIndex=-1,document.querySelector(".souviks-skip-link")))return;const link=document.createElement("a");link.className="souviks-skip-link",link.href="#main-content",link.textContent="Skip to main content",link.addEventListener("click",()=>{window.setTimeout(()=>{document.getElementById("main-content")?.focus({preventScroll:!1})},0)}),document.body.insertBefore(link,document.body.firstChild)}function bindModalFocusTrap(){const modal=document.getElementById("authModal"),dialog=modal?.querySelector('[role="dialog"]');!modal||!dialog||dialog.dataset.a11yFocusBound==="true"||(dialog.dataset.a11yFocusBound="true",document.addEventListener("keydown",event=>{if(event.key!=="Tab"||modal.hidden)return;const focusable=Array.from(dialog.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter(element=>{const style=window.getComputedStyle(element);return style.visibility!=="hidden"&&style.display!=="none"});if(!focusable.length){event.preventDefault();return}const first=focusable[0],last=focusable[focusable.length-1];if(!dialog.contains(document.activeElement)){event.preventDefault(),first.focus();return}event.shiftKey&&document.activeElement===first?(event.preventDefault(),last.focus()):!event.shiftKey&&document.activeElement===last&&(event.preventDefault(),first.focus())}))}function initialise(){ensureSkipLink(),bindModalFocusTrap()}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",initialise,{once:!0}):initialise()})();const Utils={};Utils.slugify=function(value){return value?value.toString().trim().toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,""):""},Utils.titleCase=function(value){return value?value.replace(/\w\S*/g,word=>word.charAt(0).toUpperCase()+word.substring(1).toLowerCase()):""},Utils.currency=function(value){return value==null||value===""?"":new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(value)},Utils.query=function(key){return new URLSearchParams(window.location.search).get(key)},Utils.queryNumber=function(key,fallback=1,min=Number.NEGATIVE_INFINITY,max=Number.POSITIVE_INFINITY){const raw=Utils.query(key);if(raw===null||raw==="")return fallback;const value=Number(raw);if(!Number.isFinite(value))return fallback;const integer=Math.floor(value);return Math.min(max,Math.max(min,integer))},Utils.currentSlug=function(){return window.location.pathname.split("/").pop().replace(".html","")},Utils.unique=function(array){return[...new Set(array)]},Utils.sortByName=function(array){return array.sort((a,b)=>a.name.localeCompare(b.name))},Utils.el=function(selector){return document.querySelector(selector)},Utils.els=function(selector){return[...document.querySelectorAll(selector)]},Utils.clear=function(selector){const element=typeof selector=="string"?Utils.el(selector):selector;element&&(element.innerHTML="")},Utils.debounce=function(callback,delay=300){let timer;return function(...args){clearTimeout(timer),timer=setTimeout(()=>callback.apply(this,args),delay)}},Utils.productUrl=function(product){return`/${LANG}/products/${product.slug}`},Utils.brandUrl=function(brand){return`/${LANG}/brands/${brand.slug}`},Utils.categoryUrl=function(category){return`/${LANG}/categories/${category.slug}`},Utils.vehicleUrl=function(vehicle){return`/${LANG}/vehicles/${vehicle.slug}`},Utils.emptyState=function(message="No records found."){return`

        <div class="empty-state">

            <p>${message}</p>

        </div>

    `},window.Utils=Utils;const LANG=window.souviks.currentLanguage;Utils.responsiveImageAttrs=function(src,dimensions,sizes,loading="lazy"){const attrs=[`loading="${loading}"`,'decoding="async"'];let width=null,height=null;if(Array.isArray(dimensions)&&dimensions.length===2){const w=Number(dimensions[0]),h=Number(dimensions[1]);Number.isFinite(w)&&w>0&&Number.isFinite(h)&&h>0&&(width=w,height=h)}if(width===null){const value=String(src||"").toLowerCase();value.includes("/assets/images/placeholder.webp")?(width=1200,height=1200):value.includes("/assets/images/no-results.svg")?(width=640,height=420):value.includes("/assets/logo/")||value.includes("/assets/favicon/")?(width=1024,height=1024):value.includes("/assets/icons/")?(width=24,height=24):value.includes("/assets/images/vehicles/")&&value.includes("thumbnail-400x300")&&(width=400,height=300)}return width!==null&&(attrs.push(`width="${width}"`),attrs.push(`height="${height}"`)),attrs.join(" ")};const SUPABASE_URL="https://kjxrfmujzdxatpgegqcs.supabase.co",SUPABASE_PUBLISHABLE_KEY="sb_publishable_lw2angemSUxOJrcLdbyTDw_0hQbCj3x",supabaseClient=supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{autoRefreshToken:!0,persistSession:!0,detectSessionInUrl:!0}});document.addEventListener("DOMContentLoaded",async()=>{const topSignIn=document.getElementById("topSignIn"),topUserMenu=document.getElementById("topUserMenu"),topUserButton=document.getElementById("topUserButton"),topUserName=document.getElementById("topUserName"),topUserDropdown=document.getElementById("topUserDropdown"),mobileNavSignIn=document.getElementById("mobileNavSignIn"),mobileNavUserMenu=document.getElementById("mobileNavUserMenu"),mobileNavUserName=document.getElementById("mobileNavUserName");if(typeof supabaseClient>"u"){console.error("[Souviks Auth] Supabase client unavailable.");return}function setHidden(element,hidden){element&&(element.hidden=hidden)}function closeDropdown(){topUserDropdown&&(topUserDropdown.hidden=!0,topUserButton&&topUserButton.setAttribute("aria-expanded","false"))}function openDropdown(){topUserDropdown&&(topUserDropdown.hidden=!1,topUserButton&&topUserButton.setAttribute("aria-expanded","true"))}topUserButton&&topUserDropdown&&topUserButton.addEventListener("click",event=>{event.preventDefault(),topUserButton.getAttribute("aria-expanded")==="true"?closeDropdown():openDropdown()}),document.addEventListener("click",event=>{(!topUserMenu||!topUserMenu.contains(event.target))&&closeDropdown()}),document.addEventListener("keydown",event=>{event.key==="Escape"&&closeDropdown()});async function applyAuthState(session){if(!session||!session.user){setHidden(topSignIn,!1),setHidden(topUserMenu,!0),setHidden(mobileNavSignIn,!1),setHidden(mobileNavUserMenu,!0),closeDropdown();return}const user=session.user;let fullName="";try{const{data:profile,error}=await supabaseClient.from("profiles").select("full_name").eq("id",user.id).single();!error&&profile&&(fullName=profile.full_name||"")}catch(error){SouviksErrors?.log("[Souviks Auth] Unable to load profile name:",error,"error")}fullName||(fullName=user.user_metadata?.full_name||user.user_metadata?.name||user.user_metadata?.user_name||user.user_metadata?.preferred_username||user.email?.split("@")[0]||""),fullName||(fullName="Account"),topUserName&&(topUserName.textContent=fullName),mobileNavUserName&&(mobileNavUserName.textContent=fullName),setHidden(topSignIn,!0),setHidden(topUserMenu,!1),setHidden(mobileNavSignIn,!0),setHidden(mobileNavUserMenu,!1),closeDropdown()}const runAuthStateCheck=async()=>{try{const{data,error}=await supabaseClient.auth.getSession();if(error){SouviksErrors?.log("[Souviks Auth] Unable to retrieve session:",error,"error");return}await applyAuthState(data.session)}catch(error){SouviksErrors?.log("[Souviks Auth] Unexpected auth-state error:",error,"error")}};"requestIdleCallback"in window?window.requestIdleCallback(runAuthStateCheck,{timeout:1600}):window.setTimeout(runAuthStateCheck,500),supabaseClient.auth.onAuthStateChange((event,session)=>{setTimeout(async()=>{await applyAuthState(session);try{document.dispatchEvent(new CustomEvent("souviks:auth-state",{detail:{event,session}}))}catch(error){SouviksErrors?.log("[Souviks Auth] Unable to dispatch auth-state event:",error,"warn")}},0)})}),document.addEventListener("DOMContentLoaded",()=>{const modal=document.getElementById("authModal");if(!modal)return;modal.parentElement!==document.body&&document.body.appendChild(modal);const loginForm=document.getElementById("authModalLoginForm"),registerForm=document.getElementById("authModalRegisterForm"),loginPanel=document.getElementById("authModalLoginPanel"),registerPanel=document.getElementById("authModalRegisterPanel"),title=document.getElementById("authModalTitle"),translations=document.getElementById("authModalTranslations"),loginStatus=document.getElementById("authModalLoginStatus"),registerStatus=document.getElementById("authModalRegisterStatus"),loginEmail=document.getElementById("authModalLoginEmail"),loginPassword=document.getElementById("authModalLoginPassword"),fullName=document.getElementById("authModalFullName"),registerEmail=document.getElementById("authModalRegisterEmail"),registerPassword=document.getElementById("authModalRegisterPassword"),confirmPassword=document.getElementById("authModalConfirmPassword"),tabs=modal.querySelectorAll("[data-auth-tab]");let lastFocusedElement=null;function message(key,fallback){return translations?.dataset[key]||fallback}function language(){return(document.documentElement.lang||window.souviks?.currentLanguage||"en").trim().toLowerCase()}function showStatus(element,text,type=""){element&&(element.textContent=text||"",element.className="form-status",type&&element.classList.add(type))}function setTab(tab){const register=tab==="register";loginPanel.hidden=register,registerPanel.hidden=!register,tabs.forEach(button=>{button.classList.toggle("active",button.dataset.authTab===tab)}),title.textContent=register?tabs[1]?.textContent.trim():tabs[0]?.textContent.trim(),showStatus(loginStatus,""),showStatus(registerStatus,""),window.setTimeout(()=>{(register?fullName:loginEmail)?.focus()},0)}function open(tab="login"){lastFocusedElement=document.activeElement,modal.hidden=!1,modal.setAttribute("aria-hidden","false"),document.body.classList.add("auth-modal-open"),setTab(tab)}function close(){modal.hidden=!0,modal.setAttribute("aria-hidden","true"),document.body.classList.remove("auth-modal-open"),lastFocusedElement?.focus?.(),lastFocusedElement=null}document.querySelectorAll("[data-auth-open]").forEach(trigger=>{trigger.addEventListener("click",event=>{event.preventDefault(),open(trigger.dataset.authOpen||"login")})}),modal.querySelectorAll("[data-auth-close]").forEach(trigger=>{trigger.addEventListener("click",event=>{event.preventDefault(),close()})}),tabs.forEach(button=>{button.addEventListener("click",()=>{setTab(button.dataset.authTab)})}),document.addEventListener("keydown",event=>{event.key==="Escape"&&!modal.hidden&&close()});function setDisabled(form,disabled){form?.querySelectorAll("input, button").forEach(element=>{element.disabled=disabled})}loginForm?.addEventListener("submit",async event=>{event.preventDefault(),showStatus(loginStatus,"");const email=loginEmail.value.trim(),password=loginPassword.value;if(!email){showStatus(loginStatus,message("emailRequired","Please enter your email address."),"error"),loginEmail.focus();return}if(!password){showStatus(loginStatus,message("passwordRequired","Please enter your password."),"error"),loginPassword.focus();return}if(typeof supabaseClient>"u"){showStatus(loginStatus,message("authenticationUnavailable","Authentication service is unavailable. Please try again later."),"error");return}setDisabled(loginForm,!0);try{const{data,error}=await supabaseClient.auth.signInWithPassword({email,password});if(error){const errorMessage=String(error.message||"").toLowerCase(),errorName=String(error.name||"").toLowerCase(),errorStatus=Number(error.status||0);let text=message("invalidCredentials","Invalid email or password.");errorStatus>=500||/service unavailable|temporarily unavailable|server error/.test(errorMessage)?text=message("authenticationUnavailable","Authentication service is unavailable. Please try again later."):errorMessage.includes("email not confirmed")?text=message("emailNotConfirmed","Please verify your email address before logging in."):errorMessage.includes("too many requests")||errorMessage.includes("rate limit")?text=message("tooManyAttempts","Too many login attempts. Please wait and try again."):(/network|failed to fetch|fetch failed|load failed|timeout/.test(errorMessage)||errorName.includes("retryablefetch"))&&(text=message("networkError","Unable to connect to the authentication service. Please try again.")),showStatus(loginStatus,text,"error"),setDisabled(loginForm,!1);return}if(!data?.session||!data?.user){showStatus(loginStatus,message("loginFailed","Login could not be completed. Please try again."),"error"),setDisabled(loginForm,!1);return}window.location.replace(`/${language()}/account`)}catch(error){SouviksErrors?.log("[Souviks Auth] Modal login error:",error,"error"),showStatus(loginStatus,message("somethingWentWrong","Something went wrong. Please try again."),"error"),setDisabled(loginForm,!1)}}),registerForm?.addEventListener("submit",async event=>{event.preventDefault(),showStatus(registerStatus,"");const name=fullName.value.trim(),email=registerEmail.value.trim(),password=registerPassword.value,confirmation=confirmPassword.value;if(!name){showStatus(registerStatus,message("fullNameRequired","Please enter your full name."),"error"),fullName.focus();return}if(!email){showStatus(registerStatus,message("emailRequired","Please enter your email address."),"error"),registerEmail.focus();return}if(!password){showStatus(registerStatus,message("passwordCreateRequired","Please enter a password."),"error"),registerPassword.focus();return}if(password.length<8){showStatus(registerStatus,message("passwordMinLength","Password must be at least 8 characters."),"error"),registerPassword.focus();return}if(password!==confirmation){showStatus(registerStatus,message("passwordMismatch","Passwords do not match."),"error"),confirmPassword.focus();return}if(typeof supabaseClient>"u"){showStatus(registerStatus,message("authenticationUnavailable","Authentication service is unavailable. Please try again later."),"error");return}setDisabled(registerForm,!0);try{const emailRedirectTo=`https://www.souviks.co.in/${language()}/login?auth=login`,{data,error}=await supabaseClient.auth.signUp({email,password,options:{data:{full_name:name},emailRedirectTo}});if(error){let text=message("registrationFailed","Unable to create your account. Please try again.");const errorMessage=error.message?.toLowerCase()||"";errorMessage.includes("already registered")?text=message("accountExists","An account with this email already exists."):errorMessage.includes("password")&&(text=error.message),showStatus(registerStatus,text,"error"),setDisabled(registerForm,!1);return}registerForm.reset(),showStatus(registerStatus,message("registrationSuccess","Account created successfully. Please check your email to verify your account."),"success"),setDisabled(registerForm,!1)}catch(error){SouviksErrors?.log("[Souviks Auth] Modal registration error:",error,"error"),showStatus(registerStatus,message("somethingWentWrong","Something went wrong. Please try again."),"error"),setDisabled(registerForm,!1)}});const socialCopy={en:{divider:"OR CONTINUE WITH",google:"Continue with Google",twitter:"Continue with X",unavailable:"This sign-in option is not available yet. Please use email and password or try again later."},hi:{divider:"या इसके साथ जारी रखें",google:"Google के साथ जारी रखें",twitter:"X के साथ जारी रखें",unavailable:"यह साइन-इन विकल्प अभी उपलब्ध नहीं है। कृपया ईमेल और पासवर्ड का उपयोग करें या बाद में पुनः प्रयास करें।"},bn:{divider:"অথবা এভাবে চালিয়ে যান",google:"Google দিয়ে চালিয়ে যান",twitter:"X দিয়ে চালিয়ে যান",unavailable:"এই সাইন-ইন বিকল্পটি এখনও উপলব্ধ নয়। অনুগ্রহ করে ইমেল ও পাসওয়ার্ড ব্যবহার করুন অথবা পরে আবার চেষ্টা করুন।"}};function socialLabels(){return socialCopy[language()]||socialCopy.en}function addSocialOptions(form){if(!form||form.querySelector(".auth-social-options"))return;const actions=form.querySelector(".auth-form-actions");if(!actions)return;const copy=socialLabels(),options=document.createElement("div");options.className="auth-social-options";const divider=document.createElement("div");divider.className="auth-social-divider",divider.textContent=copy.divider,options.appendChild(divider),[{provider:"google",label:copy.google,icon:"G"},{provider:"x",label:copy.twitter,icon:"𝕏"}].forEach(item=>{const button=document.createElement("button");button.type="button",button.className="auth-social-button",button.dataset.authProvider=item.provider,button.setAttribute("aria-label",item.label);const icon=document.createElement("span");icon.className="auth-social-icon",icon.setAttribute("aria-hidden","true"),icon.textContent=item.icon,button.append(icon),options.appendChild(button)}),actions.insertAdjacentElement("afterend",options)}if([loginForm,registerForm].forEach(addSocialOptions),modal.querySelectorAll("[data-auth-provider]").forEach(button=>{button.addEventListener("click",async()=>{const form=button.closest("form"),status=form===registerForm?registerStatus:loginStatus,copy=socialLabels(),provider=button.dataset.authProvider;if(["google","x"].includes(provider)){if(showStatus(status,""),typeof supabaseClient>"u"){showStatus(status,message("authenticationUnavailable","Authentication service is unavailable. Please try again later."),"error");return}setDisabled(form,!0);try{const lang=language(),safeLanguage=["en","hi","bn"].includes(lang)?lang:"en",redirectTo="https://www.souviks.co.in/"+safeLanguage+"/login?oauth=1",{error}=await supabaseClient.auth.signInWithOAuth({provider,options:{redirectTo}});error&&(SouviksErrors?.log("[Souviks Auth] Social sign-in failed:",error,"error"),showStatus(status,copy.unavailable,"error"),setDisabled(form,!1))}catch(error){SouviksErrors?.log("[Souviks Auth] Social sign-in could not start:",error,"error"),showStatus(status,copy.unavailable,"error"),setDisabled(form,!1)}}})}),new URLSearchParams(window.location.search).get("oauth")==="1")supabaseClient.auth.getSession().then(async({data,error})=>{const user=data?.session?.user;if(error||!user){open("login"),showStatus(loginStatus,socialLabels().unavailable,"error");return}const metadata=user.user_metadata||{},fullName2=metadata.full_name||metadata.name||metadata.user_name||metadata.preferred_username||user.email?.split("@")[0]||"";if(fullName2)try{const{data:profile,error:profileError}=await supabaseClient.from("profiles").select("full_name").eq("id",user.id).maybeSingle();if(!profileError&&!profile?.full_name){const{error:updateError}=await supabaseClient.from("profiles").upsert({id:user.id,full_name:fullName2},{onConflict:"id"});updateError&&SouviksErrors?.log("[Souviks Auth] Unable to initialise social profile name:",updateError,"warn")}}catch(profileError){SouviksErrors?.log("[Souviks Auth] Unable to initialise social profile:",profileError,"warn")}window.location.replace("/"+(["en","hi","bn"].includes(language())?language():"en")+"/account")}).catch(error=>{SouviksErrors?.log("[Souviks Auth] OAuth callback could not be completed:",error,"error"),open("login"),showStatus(loginStatus,socialLabels().unavailable,"error")});else{const autoOpen=new URLSearchParams(window.location.search).get("auth");(autoOpen==="login"||autoOpen==="register")&&open(autoOpen)}}),document.addEventListener("click",async event=>{const logoutButton=event.target.closest("[data-auth-logout]");if(!logoutButton)return;if(event.preventDefault(),typeof supabaseClient>"u"){console.error("[Souviks Auth] Supabase client unavailable.");return}if(logoutButton.disabled)return;logoutButton.disabled=!0;function isAccountPage(){const pathname=window.location.pathname.toLowerCase();return!!(/\/account\.html$/.test(pathname)||/\/account(?:\/|$)/.test(pathname))}function getCurrentLanguage(){return document.documentElement.lang?.trim().toLowerCase()||"en"}try{const{error}=await supabaseClient.auth.signOut();if(error){SouviksErrors?.log("[Souviks Auth] Logout failed:",error,"error"),logoutButton.disabled=!1;return}if(console.log("[Souviks Auth] Logout successful."),isAccountPage()){const loginPath=`/${getCurrentLanguage()}/login`;window.location.replace(loginPath);return}window.location.reload()}catch(error){SouviksErrors?.log("[Souviks Auth] Unexpected logout error:",error,"error"),logoutButton.disabled=!1}});const toggle=document.getElementById("language-toggle"),menu=document.getElementById("language-menu");document.querySelectorAll("#language-menu [data-language]").forEach(link=>{link.addEventListener("click",event=>{const language=event.currentTarget.dataset.language,supported=["en","bn","hi"];if(supported.includes(language))try{localStorage.setItem("svks_language",language)}catch{}const url=new URL(window.location.href),parts=url.pathname.split("/");parts.length>1&&supported.includes(parts[1])?parts[1]=language:parts.splice(1,0,language),url.pathname=parts.join("/"),window.location.href=url.toString()})}),toggle.addEventListener("click",event=>{event.stopPropagation();const isOpen=!menu.classList.contains("open");menu.classList.toggle("open",isOpen),toggle.setAttribute("aria-expanded",String(isOpen)),toggle.querySelector(".language-arrow").textContent=isOpen?"▲":"▼"}),window.SOUVIKS_SITE_CORE_READY=!0,document.addEventListener("DOMContentLoaded",()=>{const button=document.getElementById("mobileMenuButton"),navigation=document.querySelector(".main-navigation"),closeButton=document.getElementById("mobileNavigationClose");if(!button||!navigation)return;let navigationHistoryPushed=!1,pendingNavigationHref="";const focusableSelector='a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',getFocusable=()=>Array.from(navigation.querySelectorAll(focusableSelector)).filter(element=>{const style=window.getComputedStyle(element);return!element.hidden&&style.display!=="none"&&style.visibility!=="hidden"}),setNavigationState=(isOpen,{restoreFocus=!0,fromHistory=!1}={})=>{if(navigation.classList.toggle("active",isOpen),button.setAttribute("aria-expanded",String(isOpen)),button.setAttribute("aria-label",isOpen?button.dataset.closeLabel||"Close navigation":button.dataset.openLabel||"Open navigation"),navigation.setAttribute("aria-hidden",String(!isOpen)),document.body.classList.toggle("mobile-navigation-open",isOpen),isOpen){!fromHistory&&!navigationHistoryPushed&&(history.pushState({...history.state||{},souviksMobileNavigation:!0},"",window.location.href),navigationHistoryPushed=!0),window.setTimeout(()=>{getFocusable()[0]?.focus()},0);return}navigationHistoryPushed&&(fromHistory?navigationHistoryPushed=!1:history.back()),restoreFocus&&button.focus()};button.dataset.openLabel=button.getAttribute("aria-label")||"Open navigation",button.dataset.closeLabel="Close navigation",setNavigationState(!1,{restoreFocus:!1,fromHistory:!0}),button.addEventListener("click",()=>{setNavigationState(!navigation.classList.contains("active"))}),closeButton?.addEventListener("click",()=>{setNavigationState(!1)}),navigation.addEventListener("click",event=>{event.target===navigation&&setNavigationState(!1)}),navigation.querySelectorAll(".navigation-menu a, .mobile-nav-auth a, .mobile-nav-auth button").forEach(control=>{control.addEventListener("click",event=>{if(!navigation.classList.contains("active"))return;const href=control instanceof HTMLAnchorElement?control.href:"";if(href&&href!==window.location.href){event.preventDefault(),pendingNavigationHref=href,setNavigationState(!1,{restoreFocus:!1});return}setNavigationState(!1)})}),document.addEventListener("click",event=>{navigation.classList.contains("active")&&!navigation.contains(event.target)&&event.target!==button&&!button.contains(event.target)&&setNavigationState(!1)}),document.addEventListener("keydown",event=>{if(!navigation.classList.contains("active"))return;if(event.key==="Escape"){event.preventDefault(),setNavigationState(!1);return}if(event.key!=="Tab")return;const focusable=getFocusable();if(!focusable.length){event.preventDefault(),closeButton?.focus();return}const first=focusable[0],last=focusable[focusable.length-1];event.shiftKey&&document.activeElement===first?(event.preventDefault(),last.focus()):!event.shiftKey&&document.activeElement===last&&(event.preventDefault(),first.focus())}),window.addEventListener("popstate",()=>{if(navigationHistoryPushed&&(navigationHistoryPushed=!1,setNavigationState(!1,{restoreFocus:!0,fromHistory:!0}),pendingNavigationHref)){const href=pendingNavigationHref;pendingNavigationHref="",window.location.assign(href)}}),window.addEventListener("resize",()=>{window.innerWidth>992&&navigation.classList.contains("active")&&setNavigationState(!1)})}),(function(){"use strict";if(window.__SOUVIKS_IMAGE_PROTECTION_BOUND__)return;window.__SOUVIKS_IMAGE_PROTECTION_BOUND__=!0;const VIEWER_SELECTOR=".pdp-main-image img",PROTECTED_SELECTOR=[".product-image img",".pdp-main-image img",".pdp-thumbnails img",".souviks-image-zoom-image"].join(", ");let layer=null,preview=null,closeButton=null,activeSource=null,scale=1,panX=0,panY=0,dragStartX=0,dragStartY=0,dragOriginX=0,dragOriginY=0,dragging=!1;const pointers=new Map;let pinchStartDistance=0,pinchStartScale=1;function clamp(value,min,max){return Math.min(max,Math.max(min,value))}function constrainedPan(x,y){if(!preview||!layer||scale<=1.02)return{x:0,y:0};const baseWidth=preview.offsetWidth||preview.getBoundingClientRect().width,baseHeight=preview.offsetHeight||preview.getBoundingClientRect().height,viewportWidth=layer.clientWidth,viewportHeight=layer.clientHeight,overflowX=Math.max(0,(baseWidth*scale-viewportWidth)/2),overflowY=Math.max(0,(baseHeight*scale-viewportHeight)/2);return{x:clamp(x,-overflowX,overflowX),y:clamp(y,-overflowY,overflowY)}}function applyTransform(animate=!1){if(!preview)return;const constrained=constrainedPan(panX,panY);panX=constrained.x,panY=constrained.y,preview.style.transition=animate?"transform 0.18s ease":"none",preview.style.transform=`translate3d(${panX}px, ${panY}px, 0) scale(${scale})`,layer?.classList.toggle("is-zoomed",scale>1.02)}function resetTransform(){scale=1,panX=0,panY=0,applyTransform(!0)}function setScale(nextScale,animate=!1){scale=clamp(nextScale,1,4),scale===1&&(panX=0,panY=0),applyTransform(animate)}function createViewer(){if(layer)return;layer=document.createElement("div"),layer.className="souviks-image-zoom-layer",layer.id="souviksImageZoomLayer",layer.setAttribute("aria-hidden","true"),layer.setAttribute("role","dialog"),layer.setAttribute("aria-modal","true"),layer.innerHTML=`
            <h2 id="souviksImageZoomTitle" class="souviks-image-zoom-title" aria-live="polite">Product image preview</h2>
            <button
                type="button"
                class="souviks-image-zoom-close"
                aria-label="Close image preview">×</button>
            <img
                class="souviks-image-zoom-image"
                alt=""
                tabindex="0"
                draggable="false">
        `,preview=layer.querySelector(".souviks-image-zoom-image"),closeButton=layer.querySelector(".souviks-image-zoom-close"),document.body.appendChild(layer),layer.addEventListener("click",event=>{(event.target===layer||event.target===closeButton)&&closeViewer()}),preview.addEventListener("wheel",event=>{if(!layer.classList.contains("is-visible"))return;event.preventDefault();const factor=(event.deltaY<0?1:-1)>0?1.18:.85;setScale(scale*factor,!1)},{passive:!1}),preview.addEventListener("dblclick",event=>{event.preventDefault(),setScale(scale>1.02?1:2.5,!0)}),preview.addEventListener("pointerdown",event=>{if(layer.classList.contains("is-visible")&&(pointers.set(event.pointerId,{x:event.clientX,y:event.clientY}),preview.setPointerCapture?.(event.pointerId),pointers.size===1&&scale>1.02&&(dragging=!0,dragStartX=event.clientX,dragStartY=event.clientY,dragOriginX=panX,dragOriginY=panY),pointers.size===2)){dragging=!1;const[a,b]=[...pointers.values()];pinchStartDistance=Math.hypot(b.x-a.x,b.y-a.y),pinchStartScale=scale}}),preview.addEventListener("pointermove",event=>{if(pointers.has(event.pointerId)){if(pointers.set(event.pointerId,{x:event.clientX,y:event.clientY}),pointers.size===2&&pinchStartDistance>0){const[a,b]=[...pointers.values()],currentDistance=Math.hypot(b.x-a.x,b.y-a.y);currentDistance>0&&setScale(pinchStartScale*(currentDistance/pinchStartDistance),!1);return}dragging&&scale>1.02&&(panX=dragOriginX+(event.clientX-dragStartX),panY=dragOriginY+(event.clientY-dragStartY),applyTransform(!1))}});const endPointer=event=>{pointers.delete(event.pointerId),pointers.size<2&&(pinchStartDistance=0),pointers.size===0&&(dragging=!1)};preview.addEventListener("pointerup",endPointer),preview.addEventListener("pointercancel",endPointer),preview.addEventListener("pointerleave",event=>{event.buttons||endPointer(event)})}function openViewer(img){if(!img||!img.currentSrc&&!img.src)return;createViewer();const source=img.currentSrc||img.src;if(!source)return;preview.src=source,preview.alt=img.alt||"Product image";const title=layer.querySelector("#souviksImageZoomTitle");title&&(title.textContent=img.alt?`${img.alt} preview`:"Product image preview"),activeSource=img,resetTransform(),layer.setAttribute("aria-labelledby","souviksImageZoomTitle"),layer.classList.add("is-visible"),layer.setAttribute("aria-hidden","false"),document.body.classList.add("souviks-image-viewer-open"),closeButton?.focus({preventScroll:!0})}function closeViewer(){if(!layer)return;layer.classList.remove("is-visible","is-zoomed"),layer.setAttribute("aria-hidden","true"),document.body.classList.remove("souviks-image-viewer-open"),pointers.clear(),dragging=!1,pinchStartDistance=0,preview&&(preview.removeAttribute("src"),preview.alt="",preview.style.transform="");const returnTarget=activeSource;activeSource=null,returnTarget?.focus?.({preventScroll:!0})}function isProtectedImage(target){return target instanceof Element&&!!target.closest(PROTECTED_SELECTOR)}const IMAGE_FALLBACK_SELECTOR=".product-image-file, .product-image img, .brand-logo img, .entity-product-galleries img";function recoverFailedImage(image){if(!(image instanceof HTMLImageElement)||!image.matches(IMAGE_FALLBACK_SELECTOR))return;const placeholder="/assets/images/placeholder.webp";if(image.dataset.souviksImageFallback==="done"){image.getAttribute("src")===placeholder&&image.complete&&image.naturalWidth===0&&(image.style.visibility="hidden",image.hidden=!0);return}image.dataset.souviksImageFallback="done",image.removeAttribute("srcset"),image.removeAttribute("sizes"),image.style.visibility="hidden";const revealFallback=()=>{image.style.visibility="visible",image.hidden=!1};if(image.addEventListener("load",revealFallback,{once:!0}),image.getAttribute("src")!==placeholder){image.src=placeholder;return}image.hidden=!0}document.addEventListener("error",event=>recoverFailedImage(event.target),!0),document.querySelectorAll(IMAGE_FALLBACK_SELECTOR).forEach(image=>{image.complete&&image.naturalWidth===0&&recoverFailedImage(image)}),document.addEventListener("click",event=>{const img=event.target instanceof Element?event.target.closest(VIEWER_SELECTOR):null;!img||!img.complete||!img.naturalWidth||(event.preventDefault(),event.stopPropagation(),openViewer(img))},!0),document.addEventListener("keydown",event=>{if(layer?.classList.contains("is-visible")){if(event.key==="Tab"){const focusable=[closeButton,preview].filter(Boolean);if(focusable.length){const current=document.activeElement,index=focusable.indexOf(current);event.shiftKey?(event.preventDefault(),focusable[index<=0?focusable.length-1:index-1].focus({preventScroll:!0})):(event.preventDefault(),focusable[index>=focusable.length-1?0:index+1].focus({preventScroll:!0}))}return}if(event.key==="Escape"){event.preventDefault(),closeViewer();return}if(event.key==="+"||event.key==="="){event.preventDefault(),setScale(scale+.25,!0);return}if(event.key==="-"||event.key==="_"){event.preventDefault(),setScale(scale-.25,!0);return}event.key==="0"&&(event.preventDefault(),setScale(1,!0))}}),document.addEventListener("contextmenu",event=>{isProtectedImage(event.target)&&(event.preventDefault(),event.stopPropagation())},!0),document.addEventListener("dragstart",event=>{isProtectedImage(event.target)&&event.preventDefault()},!0),document.addEventListener("selectstart",event=>{isProtectedImage(event.target)&&event.preventDefault()},!0)})(),(()=>{"use strict";const placeholder="/assets/images/placeholder.webp";document.addEventListener("error",event=>{const image=event.target;image instanceof HTMLImageElement&&!image.matches(".pdp-main-image img, .pdp-thumbnails img")&&(image.dataset.souviksFallbackApplied==="true"||image.src.endsWith(placeholder)||(image.dataset.souviksFallbackApplied="true",image.src=placeholder))},!0)})();


/* ==========================================================
   SOUVIKS — ACQUISITION ATTRIBUTION
   First/last-touch source fields are kept separately from
   customer PII. Full URLs and query strings are not retained.
========================================================== */
(() => {
    "use strict";

    const STORAGE_KEY = "souviks_attribution_v1";
    const SESSION_KEY = "souviks_attribution_session_v1";
    const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
    const SESSION_MS = 30 * 60 * 1000;
    const SEARCH_HOSTS = ["google.", "bing.com", "search.yahoo.", "duckduckgo.com", "ecosia.org", "yandex.", "search.brave.com"];
    const SOCIAL_HOSTS = ["facebook.com", "instagram.com", "linkedin.com", "youtube.com", "youtu.be", "tiktok.com", "x.com", "twitter.com", "pinterest.", "threads.net", "t.me", "telegram."];

    function clean(value, limit = 120) {
        return String(value == null ? "" : value).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, limit);
    }

    function hostFromUrl(value) {
        try { return clean(new URL(value).hostname.toLowerCase(), 160); } catch { return ""; }
    }

    function matches(host, list) {
        return list.some(item => host.includes(item));
    }

    function isSameSite(host) {
        const current = String(window.location.hostname || "").toLowerCase();
        return Boolean(host && (host === current || host.endsWith("." + current) || current.endsWith("." + host)));
    }

    function safePath(path) {
        try { return clean(new URL(path, window.location.origin).pathname || "/", 500); }
        catch { return clean(window.location.pathname || "/", 500); }
    }

    function getChannel(source, medium, referrerHost, clickId) {
        const s = String(source || "").toLowerCase();
        const m = String(medium || "").toLowerCase();
        if (s.includes("whatsapp") || s === "wa" || m.includes("whatsapp")) return "whatsapp";
        if (s === "phone" || m === "phone" || m === "call") return "phone";
        if (m === "email" || m.includes("newsletter")) return "email";
        if (clickId && !m) return "paid_search";
        if (m.includes("paid_social") || (/(cpc|ppc|paid)/.test(m) && matches(s, SOCIAL_HOSTS))) return "paid_social";
        if (/(cpc|ppc|paid_search|sem)/.test(m)) return "paid_search";
        if (/(display|programmatic|paid_video)/.test(m)) return "paid_media";
        if (m === "organic" && (matches(s, SEARCH_HOSTS) || ["google", "bing", "yahoo", "duckduckgo", "ecosia", "yandex", "brave"].includes(s))) return "organic_search";
        if (m.includes("social") || matches(s, SOCIAL_HOSTS)) return "social";
        if (m === "offline" || s === "offline") return "offline";
        if (m === "direct" || s === "direct") return "direct";
        if (matches(referrerHost || s, SEARCH_HOSTS)) return "organic_search";
        if (referrerHost || s || m) return "referral";
        return "direct";
    }

    let localStore = null;
    let sessionStore = null;
    try { localStore = window.localStorage; } catch {}
    try { sessionStore = window.sessionStorage; } catch {}

    function readJson(storage, key) {
        try {
            const raw = storage && storage.getItem(key);
            return raw ? JSON.parse(raw) : null;
        } catch { return null; }
    }

    function writeJson(storage, key, value) {
        try {
            if (!storage) return false;
            storage.setItem(key, JSON.stringify(value));
            return true;
        } catch { return false; }
    }

    function directTouch(now) {
        return {
            channel: "direct", source: "direct", medium: "direct",
            campaign: "", term: "", content: "", referrer_host: "",
            landing_page: safePath(window.location.pathname),
            captured_at: new Date(now).toISOString()
        };
    }

    function taggedTouch(now, url, referrerHost) {
        const p = url.searchParams;
        const utmSource = clean(p.get("utm_source"));
        const utmMedium = clean(p.get("utm_medium"));
        const clickId = clean(p.get("gclid") || p.get("wbraid") || p.get("gbraid"), 180);
        const source = utmSource || (clickId ? "google" : referrerHost || "direct");
        const medium = utmMedium || (clickId ? "cpc" : matches(referrerHost, SEARCH_HOSTS) ? "organic" : matches(referrerHost, SOCIAL_HOSTS) ? "social" : referrerHost ? "referral" : "direct");
        return {
            channel: getChannel(source, medium, referrerHost, clickId),
            source: clean(source), medium: clean(medium),
            campaign: clean(p.get("utm_campaign")),
            term: clean(p.get("utm_term")),
            content: clean(p.get("utm_content")),
            referrer_host: clean(referrerHost, 160),
            landing_page: safePath(url.pathname),
            captured_at: new Date(now).toISOString()
        };
    }

    function capture() {
        const now = Date.now();
        const url = new URL(window.location.href);
        const candidateReferrer = hostFromUrl(document.referrer);
        const referrerHost = candidateReferrer && !isSameSite(candidateReferrer) ? candidateReferrer : "";
        const hasTags = ["utm_source", "utm_medium", "utm_campaign", "gclid", "wbraid", "gbraid"].some(k => Boolean(url.searchParams.get(k)));
        const saved = readJson(localStore, STORAGE_KEY) || {};
        const firstTime = Date.parse(saved.first && saved.first.captured_at || "");
        const lastTime = Date.parse(saved.last && saved.last.captured_at || "");
        if (!Number.isFinite(firstTime) || now - firstTime > RETENTION_MS) saved.first = null;
        if (!Number.isFinite(lastTime) || now - lastTime > RETENTION_MS) saved.last = null;
        const session = readJson(sessionStore, SESSION_KEY);
        let current;
        if (hasTags || referrerHost) {
            current = taggedTouch(now, url, referrerHost);
        } else if (session && session.touch && now - Number(session.last_active_at || 0) <= SESSION_MS) {
            current = session.touch;
        } else {
            current = directTouch(now);
        }
        writeJson(sessionStore, SESSION_KEY, { touch: current, last_active_at: now });
        let first = saved.first || null;
        let last = saved.last || null;
        if (!first || (first.channel === "direct" && current.channel !== "direct")) first = current;
        if (current.channel !== "direct" || !last) last = current;
        writeJson(localStore, STORAGE_KEY, { first, last });
        return { current, first: first || current, last: last || current };
    }

    let snapshot = capture();

    function getSnapshot() {
        if (!snapshot) snapshot = capture();
        return snapshot;
    }

    function databaseFields() {
        const s = getSnapshot();
        return {
            source_channel: clean(s.current.channel, 40),
            source: clean(s.current.source),
            medium: clean(s.current.medium),
            campaign: clean(s.current.campaign),
            term: clean(s.current.term),
            content: clean(s.current.content),
            referrer_host: clean(s.current.referrer_host, 160),
            landing_page: clean(s.current.landing_page, 500),
            conversion_page: safePath(window.location.pathname),
            first_touch_channel: clean(s.first.channel, 40),
            first_touch_source: clean(s.first.source),
            first_touch_medium: clean(s.first.medium),
            first_touch_campaign: clean(s.first.campaign),
            first_touch_term: clean(s.first.term),
            first_touch_content: clean(s.first.content),
            first_touch_referrer_host: clean(s.first.referrer_host, 160),
            first_touch_landing_page: clean(s.first.landing_page, 500),
            last_touch_channel: clean(s.last.channel, 40),
            last_touch_source: clean(s.last.source),
            last_touch_medium: clean(s.last.medium),
            last_touch_campaign: clean(s.last.campaign),
            last_touch_term: clean(s.last.term),
            last_touch_content: clean(s.last.content),
            last_touch_referrer_host: clean(s.last.referrer_host, 160),
            last_touch_landing_page: clean(s.last.landing_page, 500)
        };
    }

    function analyticsFields() {
        const s = getSnapshot();
        return {
            current_source_channel: clean(s.current.channel, 40),
            current_source: clean(s.current.source),
            current_medium: clean(s.current.medium),
            current_campaign: clean(s.current.campaign),
            first_touch_channel: clean(s.first.channel, 40),
            first_touch_source: clean(s.first.source),
            first_touch_medium: clean(s.first.medium),
            first_touch_campaign: clean(s.first.campaign),
            last_touch_channel: clean(s.last.channel, 40),
            last_touch_source: clean(s.last.source),
            last_touch_medium: clean(s.last.medium),
            last_touch_campaign: clean(s.last.campaign)
        };
    }

    function emailFields() {
        const a = databaseFields();
        return {
            lead_source_channel: a.source_channel,
            lead_source: a.source,
            lead_medium: a.medium,
            lead_campaign: a.campaign,
            lead_referrer_host: a.referrer_host,
            lead_landing_page: a.landing_page,
            lead_conversion_page: a.conversion_page,
            lead_attribution: [
                "Current source: " + a.source_channel + " / " + a.source + " / " + a.medium,
                "Campaign: " + (a.campaign || "(none)"),
                "First touch: " + a.first_touch_channel + " / " + a.first_touch_source + " / " + a.first_touch_medium,
                "Last touch: " + a.last_touch_channel + " / " + a.last_touch_source + " / " + a.last_touch_medium,
                "Landing page: " + a.landing_page,
                "Referrer: " + (a.referrer_host || "(none)")
            ].join("\n")
        };
    }

    async function recordLead(reference, leadType) {
        const ref = clean(reference, 60);
        const type = clean(leadType, 40).toLowerCase();
        if (!ref || !["contact", "request_part", "rfq_guest"].includes(type)) return false;
        try {
            const client = window.supabaseClient || (typeof supabaseClient !== "undefined" ? supabaseClient : null);
            if (!client || typeof client.rpc !== "function") return false;
            const { data, error } = await client.rpc("record_website_lead", {
                p_lead_reference: ref,
                p_lead_type: type,
                p_attribution: databaseFields()
            });
            if (error) {
                window.SouviksErrors && window.SouviksErrors.log("Lead attribution save failed", error, "warn");
                return false;
            }
            return Boolean(data && (data.recorded === true || data.duplicate === true));
        } catch (error) {
            window.SouviksErrors && window.SouviksErrors.log("Lead attribution save failed", error, "warn");
            return false;
        }
    }

    window.souviksAttribution = {
        get: () => JSON.parse(JSON.stringify(getSnapshot())),
        toAnalyticsFields: analyticsFields,
        toDatabaseFields: databaseFields,
        toFormFields: emailFields,
        recordLead
    };

    const analytics = window.souviksAnalytics || {};
    analytics.trackEvent = function (name, params = {}) {
        try {
            window.gtag("event", String(name || "event"), {
                ...params, ...analyticsFields(),
                page_location: window.location.origin + window.location.pathname,
                page_title: document.title
            });
        } catch {}
    };
    analytics.trackLead = function (type = "lead", params = {}) {
        try {
            window.gtag("event", "generate_lead", {
                lead_type: clean(type || "lead", 40),
                lead_channel: "website_form",
                funnel_stage: "enquiry_received",
                ...params, ...analyticsFields(),
                page_location: window.location.origin + window.location.pathname,
                page_title: document.title
            });
        } catch {}
    };
    window.souviksAnalytics = analytics;
    window.addEventListener("pageshow", () => { snapshot = capture(); });
})();
