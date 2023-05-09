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
