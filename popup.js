document.getElementById("copy-and-open").addEventListener("click", function () {
  console.log("Button clicked");

  // Get the current tab
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    const activeTab = tabs[0];
    console.log("Active tab retrieved:", activeTab);

    // Send a message to the content script to get the selected text of the current page
    chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      function: getSelectedText
    }, (results) => {
      console.log("Results from getSelectedText:", results);

      if (results && results[0] && results[0].result) {
        let selectedText = results[0].result;
        console.log("Selected text retrieved:", selectedText);

        // Get the prompt_text from chrome.storage.sync
        chrome.storage.sync.get("prompt_text", function (data) {
          console.log("Data from chrome.storage.sync:", data);

          let combinedText = (data.prompt_text || '');  // Start with prompt_text
          console.log("Combined text before checking clipboard:", combinedText);

          // Check clipboard for email address
          navigator.clipboard.readText().then(function (clipboardText) {
            console.log("Clipboard text retrieved:", clipboardText);

            // Regular expression to detect email addresses
            const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
            const emailMatch = clipboardText.match(emailRegex);

            if (emailMatch) {
              console.log("Email found in clipboard:", emailMatch[0]);
              combinedText += emailMatch[0] + "\n";
            } else {
              console.log("No email found in clipboard.");
            }

            // Append the selected text at the end (with a space or no newline)
            combinedText += selectedText;

            console.log("Final combined text:", combinedText);

            // Copy the combined text to the clipboard
            navigator.clipboard.writeText(combinedText).then(function () {
              console.log("Text successfully copied to clipboard");

              // Open ChatGPT
              chrome.tabs.create({ url: "https://chat.openai.com/?temporary-chat=true&model=gpt-4o-mini" });
              console.log("ChatGPT tab opened");
            }, function () {
              console.error("Failed to copy text to clipboard.");
            });
          }).catch(function (error) {
            console.error("Failed to read clipboard:", error);
          });
        });
      } else {
        console.error("Failed to retrieve selected text.");
      }
    });
  });
});

// This function retrieves only the selected text from the page
function getSelectedText() {
  const selection = window.getSelection();
  if (selection) {
    return selection.toString();
  } else {
    return '';
  }
}





function getTextFromPage() {
  console.log("Executing getTextFromPage function");
  function getTextFromElement(element) {
    let text = '';
    element.childNodes.forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) {
        text += child.textContent;
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        text += getTextFromElement(child);
      }
    });
    return text.trim();
  }
  // Extracting text from the entire document body
  let bodyText = getTextFromElement(document.body);

  console.log("Body text extracted:", bodyText);
  return bodyText;
}


document.addEventListener("DOMContentLoaded", () => {





  const clearDataButton = document.getElementById("clear-data-btn");

  if (clearDataButton) {
    clearDataButton.addEventListener("click", function () {
      alert("Data will be cleared from storage.");
      chrome.runtime.sendMessage({ type: "clearApplications" }, function (response) {
        if (response.success) {
          alert("Cleared Data.");
        } else {
          alert("Failed to clear data.");
        }
      });
    });
  } else {
    console.error("Element with ID 'clear-data-btn' not found.");
  }

  document.getElementById('view-storage-btn').addEventListener('click', function () {
    chrome.tabs.create({ url: 'storage.html' });
  });

  const forms = document.querySelectorAll("[data-form-key]");
  const displayElements = document.querySelectorAll("[data-display-key]");

  const troubleshooterToggle = document.getElementById('troubleshooter-toggle');
  const troubleshooterStatus = document.getElementById('troubleshooter-status');

  const updateTroubleshooterStatus = (enabled) => {
    if (troubleshooterStatus) {
      troubleshooterStatus.textContent = enabled ? 'Enabled' : 'Disabled';
    }
  };

  if (troubleshooterToggle) {
    chrome.storage.sync.get({ show_troubleshooter: true }, ({ show_troubleshooter }) => {
      const enabled = show_troubleshooter !== false;
      troubleshooterToggle.checked = enabled;
      updateTroubleshooterStatus(enabled);
    });

    troubleshooterToggle.addEventListener('change', () => {
      const enabled = troubleshooterToggle.checked;
      chrome.storage.sync.set({ show_troubleshooter: enabled });
      updateTroubleshooterStatus(enabled);
    });
  }

  const processForm = (form, input, current, storageKey) => {
    // If storageKey is null or undefined, return immediately
    if (!storageKey) {
      console.warn('storageKey is null or undefined');
      return;
    }

    chrome.storage.sync.get(storageKey, (data) => {
      //check if input is not null 
      if (!input) {
        return;
      }
      input.value = data[storageKey] || "";
      current.textContent = data[storageKey] || "Not set";
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();

      chrome.storage.sync.set({ [storageKey]: input.value });

      current.textContent = input.value;
    });
  };

  forms.forEach(form => {
    const input = form.querySelector('input');
    const storageKey = form.dataset.formKey;

    // Skip this iteration if storageKey is null or undefined
    if (!storageKey) {
      return;
    }

    const current = Array.from(displayElements).find(
      el => el.dataset.displayKey === storageKey
    );

    processForm(form, input, current, storageKey);
  });


});



document.getElementById('start-job').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      function: startJobCapture
    });
  });

  // ----- Status Management Section -----
  const companyInputSM = document.getElementById('sm-company');
  const roleInputSM = document.getElementById('sm-role');
  const emailInputSM = document.getElementById('sm-email');
  const stageButtonsSM = Array.from(document.querySelectorAll('#sm-buttons .sm-stage'));
  const feedbackSM = document.getElementById('sm-feedback');
  const fillStorageBtnSM = document.getElementById('sm-fill-storage');

  function setFeedback(msg, ok=true) {
    if (!feedbackSM) return;
    feedbackSM.textContent = msg;
    feedbackSM.style.color = ok ? '#0a0' : '#c00';
  }

  function highlightStage(stage) {
    stageButtonsSM.forEach(btn => {
      if (btn.dataset.stage === stage) {
        btn.style.backgroundColor = '#222';
        btn.style.color = '#fff';
        btn.style.border = '1px solid #000';
      } else {
        btn.style.backgroundColor = '#ccc';
        btn.style.color = '#000';
        btn.style.border = 'none';
      }
    });
  }

  function loadInitialStatusData() {
    chrome.storage.sync.get(['recent_company','recent_role','last_job_viewed'], syncData => {
      const recentCompany = syncData.recent_company || '';
      const recentRole = syncData.recent_role || '';
      const lastViewed = syncData.last_job_viewed || {};
      if (companyInputSM && !companyInputSM.value) companyInputSM.value = recentCompany;
      if (roleInputSM && !roleInputSM.value) roleInputSM.value = recentRole;
      if (lastViewed.company_name) companyInputSM.value = lastViewed.company_name;
      if (lastViewed.role_title || lastViewed.job_role) roleInputSM.value = lastViewed.role_title || lastViewed.job_role;
      if (lastViewed.email) emailInputSM.value = lastViewed.email;

      chrome.storage.local.get('applications', localData => {
        const apps = localData.applications || [];
        let matched = null;
        if (recentCompany) {
          matched = apps.find(a => a.company_name && a.company_name.toLowerCase() === recentCompany.toLowerCase());
        }
        if (!matched && apps.length) {
          matched = apps[apps.length - 1]; // fallback to last
        }
        if (matched) {
          if (companyInputSM) companyInputSM.value = matched.company_name || companyInputSM.value;
          if (roleInputSM) roleInputSM.value = matched.job_role || matched.role_name || roleInputSM.value;
          if (emailInputSM) emailInputSM.value = matched.email || emailInputSM.value;
          highlightStage(matched.stage_name);
        }
      });
    });
  }

  loadInitialStatusData();

  function fillFromChromeStorage() {
    chrome.storage.sync.get(['recent_company','recent_role','last_job_viewed'], syncData => {
      const rc = syncData.recent_company || '';
      const rr = syncData.recent_role || '';
      const lv = syncData.last_job_viewed || {};

      if (rc) companyInputSM.value = rc;
      if (rr) roleInputSM.value = rr;
      if (lv.company_name) companyInputSM.value = lv.company_name;
      if (lv.role_title || lv.job_role) roleInputSM.value = lv.role_title || lv.job_role;
      if (lv.email) emailInputSM.value = lv.email;

      // Try to enrich email from applications cache by company match
      chrome.storage.local.get('applications', ({ applications }) => {
        const apps = applications || [];
        const match = apps.find(a => a.company_name && a.company_name.toLowerCase() === companyInputSM.value.trim().toLowerCase());
        if (match && match.email) {
          emailInputSM.value = match.email;
          if (match.stage_name) highlightStage(match.stage_name);
        }
        setFeedback('Fields filled from storage');
      });
    });
  }

  if (fillStorageBtnSM) {
    fillStorageBtnSM.addEventListener('click', (e) => {
      e.preventDefault();
      fillFromChromeStorage();
    });
  }

  function getCSRFAndSession(baseUrl) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'getSessionCookie', url: baseUrl }, sessionCookie => {
        if (!sessionCookie) {
          reject(new Error('No session cookie'));
          return;
        }
        chrome.runtime.sendMessage({ type: 'getCSRFToken', url: baseUrl }, csrfToken => {
          if (!csrfToken) {
            reject(new Error('No CSRF token'));
            return;
          }
          resolve({ session: sessionCookie.value, csrf: csrfToken });
        });
      });
    });
  }

  async function sendStageUpdate(stage) {
    const company = companyInputSM.value.trim();
    const role = roleInputSM.value.trim();
    const toEmail = emailInputSM.value.trim();
    if (!company) {
      setFeedback('Company required', false);
      return;
    }
    chrome.storage.sync.get('base_url', async ({ base_url }) => {
      const baseUrl = base_url || 'https://www.pingojo.com';
      let creds;
      try {
        creds = await getCSRFAndSession(baseUrl);
      } catch (err) {
        setFeedback('Auth missing - login in a tab.', false);
        return;
      }
      const payload = {
        company_name: company,
        stage_name: stage,
        role_title: role,
        to_email: toEmail
      };
      fetch(baseUrl + '/api/application/', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': 'sessionid=' + creds.session,
          'X-CSRFToken': creds.csrf
        },
        body: JSON.stringify(payload)
      }).then(r => {
        if (!r.ok) throw new Error('Network');
        return r.json();
      }).then(data => {
        // update local storage copy
        chrome.storage.local.get('applications', ({ applications }) => {
          let apps = applications || [];
          const idx = apps.findIndex(a => a.company_name && a.company_name.toLowerCase() === company.toLowerCase());
          if (idx >= 0) {
            apps[idx].stage_name = stage;
            apps[idx].job_role = role || apps[idx].job_role;
            apps[idx].role_name = role || apps[idx].role_name;
            apps[idx].email = toEmail || apps[idx].email;
          } else {
            apps.push({ company_name: company, job_role: role, role_name: role, email: toEmail, stage_name: stage });
          }
          chrome.storage.local.set({ applications: apps }, () => {});
        });
        highlightStage(stage);
        chrome.storage.sync.set({ recent_company: company, recent_role: role });
        setFeedback('Updated stage to ' + stage);
      }).catch(err => {
        setFeedback('Failed to update: ' + err.message, false);
      });
    });
  }

  stageButtonsSM.forEach(btn => {
    btn.addEventListener('click', () => {
      const stage = btn.dataset.stage;
      sendStageUpdate(stage);
    });
  });

});

function startJobCapture() {
  alert('Starting job capture! Follow the prompts on the page.');
  // Initialize the job capture by calling functions in the content script.
  window.postMessage({ action: 'start-job-capture' }, '*');
}


document.getElementById('submit-email').addEventListener('click', () => {
  const company_email = document.getElementById('company_email').value;
  chrome.runtime.sendMessage({ action: 'submit-job', company_email });
});