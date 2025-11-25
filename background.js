chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'getSessionCookie') {
    chrome.cookies.get({
      url: request.url,
      name: 'sessionid'
    }, (cookie) => {
      sendResponse(cookie);
    });
    return true;
  }
});


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'getCSRFToken') {
    chrome.cookies.get({
      url: message.url,
      name: 'csrftoken'
    }, (cookie) => {
      if (cookie) {
        sendResponse(cookie.value);
      } else {
        sendResponse(null);
      }
    });
    return true;
  }
});


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'getCurrentTab') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentTab = tabs[0];
      sendResponse(currentTab);
    });
    return true;
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getText') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs.length) {
        sendResponse('');
        return;
      }

      chrome.scripting.executeScript(
        {
          target: { tabId: tabs[0].id },
          func: () => document.body?.innerText ?? ''
        },
        (results) => {
          if (chrome.runtime.lastError) {
            console.error('Failed to capture page text:', chrome.runtime.lastError);
            sendResponse('');
            return;
          }

          const [{ result = '' } = {}] = results || [];
          sendResponse(result);
        }
      );
    });

    return true;
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'clearApplications') {
    chrome.storage.local.remove('applications', () => {
      if (chrome.runtime.lastError) {
        console.error('Error clearing data:', chrome.runtime.lastError);
        sendResponse({ success: false });
      } else {
        console.log('Data cleared successfully.');
        sendResponse({ success: true });
      }
    });
    return true; // Keep the message channel open for the async response
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getSelectedText') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs.length) {
        sendResponse({ text: '' });
        return;
      }

      chrome.scripting.executeScript(
        {
          target: { tabId: tabs[0].id },
          func: () => (window.getSelection ? window.getSelection().toString() : '')
        },
        (results) => {
          if (chrome.runtime.lastError) {
            console.error('Failed to capture selected text:', chrome.runtime.lastError);
            sendResponse({ text: '' });
            return;
          }

          const [{ result = '' } = {}] = results || [];
          sendResponse({ text: result });
        }
      );
    });

    return true;
  }
});


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'ask-email') {
    const jobData = request.jobData || {};

    chrome.storage.local.set({ jobData }, () => {
      if (chrome.runtime.lastError) {
        console.error('Unable to save job data:', chrome.runtime.lastError);
        sendResponse({ success: false });
        return;
      }

      chrome.action.openPopup();
      sendResponse({ success: true });
    });

    return true;
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.clear();
});

// Send job data to the server when ready
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'submit-job') {
    chrome.storage.local.get(['jobData'], (result) => {
      if (chrome.runtime.lastError) {
        console.error('Unable to read job data:', chrome.runtime.lastError);
        sendResponse({ success: false });
        return;
      }

      const jobData = { ...(result.jobData || {}), email: request.email };

      fetch('https://www.pingojo.com/job_add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(jobData)
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
          }

          sendResponse({ success: true });
        })
        .catch((error) => {
          console.error('Failed to submit job:', error);
          sendResponse({ success: false, error: error.message });
        });
    });

    return true; // Indicates async response
  }
});