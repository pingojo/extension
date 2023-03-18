chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'addContact') {
      const { name, email } = request.contact;
      console.log('Contact added:', name, email);
      sendResponse({ success: true });
    }
  });
  