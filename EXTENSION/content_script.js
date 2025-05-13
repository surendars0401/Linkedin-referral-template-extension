// content_script.js

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getProfileData") {
        console.log("Content script: Received request for profile data.");
        const profileData = extractData();
        console.log("Content script: Extracted Data:", profileData);
        sendResponse(profileData);
        return true; // Async
    }
});


function extractData() {
    let name = null;
    let company = null;
    // List of keywords to help identify/exclude job titles when looking for a Company Name
    const commonJobKeywords = ["engineer", "developer", "manager", "lead", "editor", "specialist", "analyst", "architect", "consultant", "designer", "director", "officer", "president", "founder", "intern", "assistant", "associate", "coordinator", "executive", "representative", "senior", "junior", "trainee", "volunteer", "member", "artist", "writer", "head", "chief", "recruiter"];


    //==================================================================
    // --- NAME EXTRACTION (Multi-Attempt DOM + URL Fallback) ---
    //==================================================================
     try {
         // ATTEMPT 1: Try the known, semantic class first (if it exists)
         const nameElementSemantic = document.querySelector('h1.text-heading-xlarge');
         if (nameElementSemantic) {
             name = nameElementSemantic.textContent.trim().split(' ')[0];
             console.log("Content script: Name from 'h1.text-heading-xlarge' (Attempt 1):", name);
         }

         // ATTEMPT 2: Try H1 using other, more structural/behavioural classes (like h1.break-words, from HTML sample)
         if (!name) {
            const nameElementStructural = document.querySelector('h1.break-words');
             if (nameElementStructural) {
                  name = nameElementStructural.textContent.trim().split(' ')[0];
                  console.log("Content script: Name from 'h1.break-words' (Attempt 2):", name);
             }
         }

        // ATTEMPT 3: Try the older fallback selector for older layouts
         if (!name) {
             const altNameElement = document.querySelector('.pv-text-details__left-panel h1');
             if (altNameElement) {
                  name = altNameElement.textContent.trim().split(' ')[0];
                   console.log("Content script: Name from '.pv-text-details__left-panel h1' (Attempt 3):", name);
             }
         }

         // ATTEMPT 4: Fallback to URL Parsing if DOM selectors failed
         if (!name || name.trim() === "") {
             console.log("Content script: DOM methods failed for Name. Attempting to get name from URL (Attempt 4).");
                 const pathParts = window.location.pathname.split('/');
                 // Expected URL: /in/profile-name-slug/
                 if (pathParts.length > 2 && pathParts[1] === 'in' && pathParts[2]) {
                     let profileSlug = pathParts[2].split('?')[0].split('#')[0]; // Clean slug
                     const nameParts = profileSlug.split('-');
                     if (nameParts.length > 0 && nameParts[0]) {
                         // Capitalize the first letter
                         name = nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1);
                         console.log("Content script: Name extracted from URL:", name);
                    }
                 }
          }
     } catch(e) {
          console.error("Content script: Error during NAME extraction:", e);
     }

    //==================================================================
    // --- COMPANY EXTRACTION (Using the logic from the previous version) ---
     //==================================================================
    try {
        let experienceSection = null;
        const h2Elements = document.querySelectorAll('h2');
         h2Loop: for (const h2 of h2Elements) {
             const sectionId = h2.id;
             if (sectionId && sectionId.toLowerCase().startsWith('experience')) {
                 experienceSection = h2.closest('section');
                 if (experienceSection) break h2Loop;
             }
             if (!experienceSection && h2.textContent.trim().toLowerCase().includes('experience')) {
                  let container = h2.parentElement;
                 for (let i = 0; i < 3; i++) {
                      if (!container) break;
                     let listContainer = container.querySelector('ul.pvs-list, div.pvs-list, ul[aria-label*="Experience"], div[aria-label*="Experience"]');
                     if (listContainer) {
                         experienceSection = listContainer.closest('section') || listContainer;
                         break h2Loop;
                     }
                     container = container.nextElementSibling;
                 }
                 if (!experienceSection) experienceSection = h2.closest('section');
                 if (experienceSection) break h2Loop;
             }
         }


        if (experienceSection) {
           // console.log("Content script: Found Experience Section/Container:", experienceSection);
            const firstExperienceItem = experienceSection.querySelector('li.pvs-list__paged-list-item, li.artdeco-list__item, div.pvs-entity');

            if (firstExperienceItem) {
              //  console.log("Content script: Found first experience item:", firstExperienceItem);

                // Attempt 1: Structure like the previous HTML (<a> wrapping, or <div> wrapping)
                const companyDetailsSpan = firstExperienceItem.querySelector('a > span.t-14.t-normal:nth-of-type(1), div > span.t-14.t-normal:nth-of-type(1)');
                 if (companyDetailsSpan && companyDetailsSpan.querySelector('span[aria-hidden="true"]')) {
                    let companyText = companyDetailsSpan.querySelector('span[aria-hidden="true"]').textContent.trim();
                    let potentialCompany = companyText.split('·')[0].trim();
                    // Validate if it looks like a job title
                     if (potentialCompany && !commonJobKeywords.some(keyword => potentialCompany.toLowerCase().includes(keyword))) {
                         company = potentialCompany;
                         console.log("Content script: Company from 'a|div > span.t-14.t-normal' (Company Attempt 1):", company);
                    } else {
                         console.warn("Content script: Company Attempt 1 result '" + potentialCompany + "' might be a job title. Clearing.");
                    }
                 }

                // Attempt 2: More general 'span.t-normal[aria-hidden="true"]' if Attempt 1 failed
                if (!company) {
                    const genericCompanySpan = firstExperienceItem.querySelector('span.t-normal[aria-hidden="true"], span.t-14.t-normal[aria-hidden="true"]');
                    if (genericCompanySpan) {
                        let potentialCompanyText = genericCompanySpan.textContent.trim().split('·')[0].trim();
                        const jobTitleElementInsideItem = firstExperienceItem.querySelector('.t-bold span[aria-hidden="true"]');
                        let jobTitleText = jobTitleElementInsideItem ? jobTitleElementInsideItem.textContent.trim() : "";
                        if (potentialCompanyText !== jobTitleText && !commonJobKeywords.some(keyword => potentialCompanyText.toLowerCase().includes(keyword))) {
                            company = potentialCompanyText;
                             console.log("Content script: Company from generic 'span.t-normal' (Company Attempt 2):", company);
                        } else {
                              console.warn("Content script: Generic span text (Company Attempt 2) '" + potentialCompanyText + "' matches job title or keyword. Skipping.");
                        }
                    }
                }

                // Attempt 3: Linked company names (if attempts 1 & 2 failed)
                if (!company) {
                   // Logic from previous version
                   // ...
                }

                // Attempt 4: Fallback to image alt text (if attempts 1, 2, 3 failed)
                 if (!company) {
                   // Logic from previous version
                   // ...
                 }

            } else {
                console.warn("Content script: Could not find the first experience item.");
            }
        } else {
             console.warn("Content script: Could not find the Experience section. Trying page-level fallback.");
              // ... Top Card Fallback logic from previous version
        }

    } catch (error) {
        console.error("Content script: Error during COMPANY extraction:", error);
    }

    // --- ** Final Cleanup ** ---
    name = name ? name.trim() : "Profile User";
    company = company ? company.trim() : "[Company Name]";

   // Re-run final job title check for company here if desired...

    return { name, company };
}
// Log when the content script is injected/runs for easier debugging of reloads
console.log("LinkedIn Profile Formatter content script loaded/reloaded (v5 - refined NAME and company extraction).");