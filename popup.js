document.getElementById("copy-and-open").addEventListener("click", function () {

  // Get the current tab
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    const activeTab = tabs[0];

    // Send a message to the content script to get the selected text of the current page
    chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      function: getSelectedText
    }, (results) => {

      if (results && results[0] && results[0].result) {
        let selectedText = results[0].result;

        // Get the prompt_text from chrome.storage.sync
        chrome.storage.sync.get("prompt_text", function (data) {

          let combinedText = (data.prompt_text || '');  // Start with prompt_text

          // Check clipboard for email address
          navigator.clipboard.readText().then(function (clipboardText) {

            // Regular expression to detect email addresses
            const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
            const emailMatch = clipboardText.match(emailRegex);

            if (emailMatch) {
              combinedText += emailMatch[0] + "\n";
            } else {
            }

            // Append the selected text at the end (with a space or no newline)
            combinedText += selectedText;


            // Copy the combined text to the clipboard
            navigator.clipboard.writeText(combinedText).then(function () {

              // Open ChatGPT
              chrome.tabs.create({ url: "https://chat.openai.com/?temporary-chat=true&model=gpt-4o-mini" });
            }, function () {
            });
          }).catch(function (error) {
          });
        });
      } else {
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
  }

  document.getElementById('view-storage-btn').addEventListener('click', function () {
    chrome.tabs.create({ url: 'storage.html' });
  });

  const forms = document.querySelectorAll("[data-form-key]");
  const displayElements = document.querySelectorAll("[data-display-key]");

  const exportedSettingKeys = [
    'base_url',
    'prompt_text',
    'full_name',
    'email_address',
    'resume_url',
    'show_troubleshooter'
  ];
  const exportSettingsButton = document.getElementById('export-settings-btn');
  const importSettingsButton = document.getElementById('import-settings-btn');
  const importSettingsFile = document.getElementById('import-settings-file');
  const settingsTransferStatus = document.getElementById('settings-transfer-status');
  const troubleshooterToggle = document.getElementById('troubleshooter-toggle');
  const troubleshooterStatus = document.getElementById('troubleshooter-status');

  const setSettingsTransferStatus = (message, ok = true) => {
    if (!settingsTransferStatus) return;
    settingsTransferStatus.textContent = message;
    settingsTransferStatus.style.color = ok ? '#0a0' : '#c00';
  };

  const updateTroubleshooterStatus = (enabled) => {
    if (troubleshooterStatus) {
      troubleshooterStatus.textContent = enabled ? 'Enabled' : 'Disabled';
    }
  };

  const refreshSettingsDisplay = () => {
    chrome.storage.sync.get(exportedSettingKeys, (data) => {
      forms.forEach(form => {
        const storageKey = form.dataset.formKey;
        if (!exportedSettingKeys.includes(storageKey)) return;

        const input = form.querySelector('input, textarea');
        const current = Array.from(displayElements).find(
          el => el.dataset.displayKey === storageKey
        );

        if (input) input.value = data[storageKey] || '';
        if (current) current.textContent = data[storageKey] || 'Not set';
      });

      const enabled = data.show_troubleshooter === true;
      if (troubleshooterToggle) troubleshooterToggle.checked = enabled;
      updateTroubleshooterStatus(enabled);
    });
  };

  if (exportSettingsButton) {
    exportSettingsButton.addEventListener('click', () => {
      chrome.storage.sync.get(exportedSettingKeys, (settings) => {
        if (chrome.runtime.lastError) {
          setSettingsTransferStatus('Unable to export settings.', false);
          return;
        }

        const payload = {
          version: 1,
          settings
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = 'pingojo-settings.json';
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
        setSettingsTransferStatus('Settings exported.');
      });
    });
  }

  if (importSettingsButton && importSettingsFile) {
    importSettingsButton.addEventListener('click', () => importSettingsFile.click());

    importSettingsFile.addEventListener('change', async () => {
      const [file] = importSettingsFile.files;
      if (!file) return;

      try {
        const parsed = JSON.parse(await file.text());
        const importedSettings = parsed.settings || parsed;
        if (!importedSettings || typeof importedSettings !== 'object' || Array.isArray(importedSettings)) {
          throw new Error('Settings JSON must contain an object.');
        }

        const settingsToSave = {};
        exportedSettingKeys.forEach(key => {
          if (!Object.prototype.hasOwnProperty.call(importedSettings, key)) return;

          const value = importedSettings[key];
          const hasValidType = key === 'show_troubleshooter'
            ? typeof value === 'boolean'
            : typeof value === 'string';

          if (!hasValidType) {
            throw new Error(`Invalid value for ${key}.`);
          }
          settingsToSave[key] = value;
        });

        if (Object.keys(settingsToSave).length === 0) {
          throw new Error('No supported settings were found.');
        }

        chrome.storage.sync.set(settingsToSave, () => {
          if (chrome.runtime.lastError) {
            setSettingsTransferStatus('Unable to import settings.', false);
            return;
          }

          refreshSettingsDisplay();
          setSettingsTransferStatus('Settings imported.');
        });
      } catch (error) {
        setSettingsTransferStatus(`Import failed: ${error.message}`, false);
      } finally {
        importSettingsFile.value = '';
      }
    });
  }

  if (troubleshooterToggle) {
    chrome.storage.sync.get({ show_troubleshooter: false }, ({ show_troubleshooter }) => {
      const enabled = show_troubleshooter === true;
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
      return;
    }

    chrome.storage.sync.get(storageKey, (data) => {
      //check if input is not null 
      if (!input) {
        return;
      }
      input.value = data[storageKey] || "";
      if (current) {
        current.textContent = data[storageKey] || "Not set";
      }
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();

      chrome.storage.sync.set({ [storageKey]: input.value }, () => {
        if (chrome.runtime.lastError) {
          setSettingsTransferStatus(`Unable to save ${storageKey}.`, false);
          return;
        }

        if (current) {
          current.textContent = input.value || "Not set";
        }
        setSettingsTransferStatus('Settings saved.');
      });
    });
  };

  forms.forEach(form => {
    const input = form.querySelector('input, textarea');
    const storageKey = form.dataset.formKey;

    // Skip this iteration if storageKey is null or undefined
    if (!storageKey) {
      return;
    }

    const current = Array.from(displayElements).find(
      el => el.dataset.displayKey === storageKey
    );

    // Some action forms use data-form-key but do not display a stored value.
    if (!current) {
      return;
    }

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
