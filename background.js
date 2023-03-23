chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'addContact') {
      const { name, email } = request.contact;
      console.log('Contact added:', name, email);
      sendResponse({ success: true });
    }
  });
  

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("request", request)
    if (request.type === 'getSessionCookie') {
      chrome.cookies.get({ url: request.url, name: 'sessionid' }, (cookie) => {
        sendResponse(cookie);
      });
      return true; // This is required to use sendResponse asynchronously.
    }
    // ... (handle other message types if needed)
  });
  


  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'getCSRFToken') {
      chrome.cookies.get({ url: message.url, name: 'csrftoken' }, (cookie) => {
        if (cookie) {
          sendResponse(cookie.value);
        } else {
          sendResponse(null);
        }
      });
      return true; // Return true to indicate that sendResponse will be called asynchronously
    }
  });
