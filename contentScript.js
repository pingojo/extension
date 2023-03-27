const observer = new MutationObserver(mutationsList => {
  // Check each mutation that was observed
  
  for (const mutation of mutationsList) {
    // If a new email has been added to the DOM, call the callback function
    if (mutation.type === 'childList' && mutation.addedNodes.length) {
      const addedNode = mutation.addedNodes[0];
      if (addedNode.tagName === 'DIV' && addedNode.getAttribute('role') === 'listitem') {
        addButtonAndInput();
        
      }
    }
  }
  handleDomChanges();
});

const observerConfig = {
  childList: true,
  subtree: true
};

const targetNode = document.querySelector('body');

observer.observe(targetNode, observerConfig);

const subjectTemplates = [
  /Interview Invitation from (.*)/,
  /Interview Request from (.*)/,
  /Interview Opportunity with (.*)/,
  /Invitation to Interview at (.*)/,
  /(.*) Interview Invitation/,
  /(.*) Application Update/,
  /Thank you for your interest with (.*)/,
  /Your job application with (.*)/,
  /Thanks for your interest in (.*), .*/,
  /Important information about your application to (.*)/,
  /Your application to (.*) was accepted!/,
  /Thank you for your interest in(?: joining)? (.*)/,
  /Application to (.*) successfully submitted/,
  /Update on your job application with (.*)/,
  /Follow-up from your successful application to (.*)!/,
  /Thank you for your application - (.*)/,
  /Thank you for applying to (.*) │/,
];

observer.observe(document.body, {
  childList: true,
  subtree: true,
});


function handleDomChanges() {
  const emailHeaders = document.querySelectorAll('.zA');
  emailHeaders.forEach((header) => {
    if (!header.querySelector('.crm-icon')) {
      addCrmIcon(header);
    }
  });

}

function getCookieValue(cookieString, cookieName) {
  const cookiePairs = cookieString.split('; ');
  for (let i = 0; i < cookiePairs.length; i++) {
    const pair = cookiePairs[i].split('=');
    if (pair[0] === cookieName) {
      return pair[1];
    }
  }
  return null;
}

function sendDataToDRF(stage, domain, nameEmail, companyName, datetime, fromAddress, gmailId, roleName) {
  const payload = {
    company_name: companyName,
    stage_name: stage,
    source_domain: domain,
    source_email: nameEmail.email,
    source_name: nameEmail.name,
    email_date: datetime,
    gmail_id: gmailId,
    from_email: fromAddress,
    role_title: roleName,
  };

  return new Promise((resolve, reject) => {
    chrome.storage.sync.get("base_url", ({ base_url }) => {
      var base_url = base_url || "https://www.pingojo.com";
      var full_url = base_url + "/api/application/";
      chrome.runtime.sendMessage({
        type: 'getSessionCookie',
        url: base_url
      }, (sessionCookie) => {
        if (sessionCookie) {
          chrome.runtime.sendMessage({
            type: 'getCSRFToken',
            url: base_url
          }, (csrfToken) => {
            if (csrfToken) {
              headers = {
                'Content-Type': 'application/json',
                'Cookie': `sessionid=${sessionCookie.value}`,
                'X-CSRFToken': csrfToken,
              }
              fetch(full_url, {
                  method: 'POST',
                  credentials: 'include',
                  headers: headers,
                  body: JSON.stringify(payload)
                })
                .then(response => {
                  if (!response.ok) {
                    alert('Network response was not ok', JSON.stringify(response));
                    throw new Error('Network response was not ok');
                  }
                  return response.json();
                })
                .then(data => {
                  addOrUpdatePingojoEntry(data.total_applications)
                  resolve(data);
                })
                .catch(error => {
                  alert('There was a problem with the fetch operation:', error)
                  console.error('There was a problem with the fetch operation:', error);
                  reject(error);
                });
            } else {
              console.error('Session cookie not found');
              window.location = base_url + '/accounts/login/?from=gmail';
              reject(new Error('Session cookie not found'));
            }
          });
        } else {
          console.error('Session cookie not found');
          window.location = base_url + '/accounts/login/?from=gmail';
          reject(new Error('Session cookie not found'));
        }
      });
    });
  });
}

function createDropdownMenu(nameEmail, domain, companyName, datetime, fromAddress, gmailId) {
  const dropdown = document.createElement('div');
  dropdown.classList.add('dropdown-menu');
  dropdown.style.cssText = 'position: absolute; display: none; background-color: white; border: 1px solid #ddd; z-index: 1000; padding: 8px;';

  const addItem = (text, callback) => {
    const item = document.createElement('div');
    item.style.cssText = 'cursor: pointer; padding: 4px 8px;';
    item.textContent = text;

    item.addEventListener('click', (event) => {
      event.stopPropagation();
      callback();
      toggleDropdown(dropdown);
    });

    dropdown.appendChild(item);
  };

  addItem('Add Contact', () => {
    chrome.runtime.sendMessage({
      type: 'addContact',
      contact: nameEmail
    }, (response) => {
      if (response.success) {
        alert('Contact added');
      }
    });
  });

  addItem('Applied', () => sendDataToDRF('Applied',  nameEmail, domain, companyName, datetime, fromAddress, gmailId));
  addItem('Next', () => sendDataToDRF('Next',   nameEmail, domain, companyName, datetime, fromAddress, gmailId));
  addItem('Scheduled', () => sendDataToDRF('Scheduled',   nameEmail, domain, companyName, datetime, fromAddress, gmailId));
  addItem('Passed', () => sendDataToDRF('Passed',  nameEmail, domain, companyName, datetime, fromAddress, gmailId));
  return dropdown;
}

function toggleDropdown(dropdown) {
  if (dropdown.style.display === 'none') {
    dropdown.style.display = 'block';
  } else {
    dropdown.style.display = 'none';
  }
}



function sendDetailInfoToDRF(stage) {
  return new Promise((resolve, reject) => {
    const emailContainer = document.querySelector('.h7 [data-legacy-message-id]');
    if (!emailContainer) reject(new Error('Email container not found'));

    const emailMetaInfo = emailContainer.querySelector('.gE.iv.gt');

    const inputField2 = document.querySelector('#company_input_field');
    let companyName = '';
    if (inputField2) {
      companyName = inputField2.value;
    }
    
    const inputFieldRole = document.querySelector('#role_input_field');
    let roleName = '';
    if (inputFieldRole) {
      roleName = inputFieldRole.value;
    }

    if (emailMetaInfo) {
      const fromEmailElement = emailMetaInfo.querySelector('.go');
      const fromAddress = fromEmailElement ? fromEmailElement.textContent : '';
      const datetimeElement = emailMetaInfo.querySelector('.g3');
      const datetime = datetimeElement ? datetimeElement.getAttribute('title') : '';
      const nameEmail = extractSenderInfoFromDetail(emailMetaInfo);
      const domain = parseDomain(nameEmail.email);
      
      chrome.runtime.sendMessage({ type: 'getCurrentTab' }, (currentTab) => {
        if (!currentTab) reject(new Error('Current tab not found'));
  
        var url = currentTab.url;
        var gmailIdMatch = url.match(/\/([a-zA-Z0-9]+)$/);
        var gmailId = gmailIdMatch ? gmailIdMatch[1] : null;
        const cleanedDatetime = datetime.replace(/\u202F/g, ' ');

        sendDataToDRF(stage, nameEmail, domain, companyName, cleanedDatetime, fromAddress, gmailId, roleName)
        .then((data) => {
          resolve(data);
        })
        .catch((error) => {
          reject(error);
        });
      });



   


    } else {
      reject(new Error('Email metadata not found or template not matched'));
    }
  });
}


function createDetailButton(label, spinner, checkmark) {
  const button = document.createElement('button');
  button.textContent = label;
  button.style.margin = '5px';
  button.style.padding = '5px';
  button.style.backgroundColor = '#4285f4';
  button.style.color = 'white';
  button.style.border = 'none';
  button.style.borderRadius = '5px';
  button.style.cursor = 'pointer';
  button.onclick = function () {
    spinner.style.display = 'block';
    sendDetailInfoToDRF(label)
      .then(() => {
        spinner.style.display = 'none';
        checkmark.style.display = 'block';
        setTimeout(() => {
          checkmark.style.display = 'none';
        }, 2000);
      })
      .catch((error) => {
        console.error('Error:', error);
        spinner.style.display = 'none';
        alert('Failed to send data');
      });
  };
  return button;
}

function extractSenderInfoFromDetail(emailMetaInfo) {
  const senderDetails = emailMetaInfo.querySelector('.go');
  if (!senderDetails) return {
    name: '',
    email: ''
  };

  const email = senderDetails.textContent;
  const name = senderDetails.getAttribute('name');

  return {
    name,
    email
  };
}


function addCrmIcon(emailHeader) {
  const nameEmail = extractSenderInfo(emailHeader);
  const subjectInfo = extractSubjectInfo(emailHeader);
  const domain = parseDomain(nameEmail.email);
  const datetime = extractDatetime(emailHeader);
  const {
    email: fromAddress
  } = extractSenderInfo(emailHeader);
  const gmailId = extractGmailId(emailHeader);

  let companyName = "";
  let matchTemplate = false;

  for (const template of subjectTemplates) {
    const match = subjectInfo.subject.match(template);
    if (match) {
      companyName = match[1];
      matchTemplate = true;
      break;
    }
  }

  if (domain) {
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}`;

    const img = document.createElement("img");
    img.src = faviconUrl;
    img.style.cssText = "width: 20px; height: 20px; cursor: pointer;";
    img.classList.add("crm-icon");

    if (matchTemplate) {
      img.style.border = "2px solid #42d692";
    }

    img.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleDropdown(dropdown);
    });

    const td = document.createElement("td");
    td.style.verticalAlign = "middle";
    td.appendChild(img);

    const dropdown = createDropdownMenu(nameEmail, domain, companyName, datetime, fromAddress, gmailId);
    td.appendChild(dropdown);

    const firstCell = emailHeader.querySelector("td");
    if (firstCell) {
      emailHeader.insertBefore(td, firstCell);
    }
  }
}

function extractDatetime(emailHeader) {
  const datetimeElement = emailHeader.querySelector("td.xY span[title]");
  if (!datetimeElement) return '';

  const datetime = datetimeElement.getAttribute("title");
  const cleanedDatetime = datetime.replace(/\u202F/g, ' ');
  return cleanedDatetime;
}


function listenHashChanged() {
  window.onhashchange = function () {
    addButtonAndInput();
  }
}

function extractSubjectInfo(emailHeader) {
  const subjectElement = emailHeader.querySelector('.xT .y6 span');
  if (!subjectElement) return {
    subject: ''
  };

  const subject = subjectElement.textContent;
  return {
    subject
  };
}


function extractSenderInfo(emailHeader) {
  const senderDetails = emailHeader.querySelector('.yW span[email]');
  if (!senderDetails) return {
    name: '',
    email: '',
    gmailId: ''
  };

  const email = senderDetails.getAttribute('email');
  const name = senderDetails.textContent;
  const gmailIdElement = emailHeader.closest('[data-legacy-conversation-id]');
  const gmailId = gmailIdElement ? gmailIdElement.getAttribute('data-legacy-conversation-id') : '';

  return {
    name,
    email,
    gmailId
  };
}

function extractGmailId(emailHeader) {
  const emailRow = emailHeader.closest('tr[data-legacy-thread-id]');
  if (!emailRow) return '';
  const gmailId = emailRow.getAttribute('data-legacy-thread-id');
  return gmailId;
}

function parseDomain(email) {
  const domain = email.substring(email.lastIndexOf('@') + 1);
  const parts = domain.split('.');
  if (parts.length > 2) {
    parts.shift();
  }
  return parts.join('.');
}

document.addEventListener('click', () => {
  const dropdowns = document.querySelectorAll('.dropdown-menu');
  dropdowns.forEach((dropdown) => {
    dropdown.style.display = 'none';
  });
});

let pingojoEntry = null;

function createPingojoEntry(count) {
  const entryContainer = document.createElement('div');
  entryContainer.classList.add('Xa', 'ZR', 'XT', 'adZ', 'Xr');

  const countContainer = document.createElement('div');
  countContainer.classList.add('V6', 'CL', 'Xj');
  countContainer.setAttribute('aria-label', `Pingojo, ${count} items`);
  countContainer.setAttribute('role', 'link');
  countContainer.tabIndex = -1;

  const countSpan = document.createElement('span');
  countSpan.classList.add('XS');

  const countValue = document.createElement('span');
  countValue.classList.add('XU');
  countValue.setAttribute('aria-hidden', 'true');
  countValue.textContent = count;

  countSpan.appendChild(countValue);
  countContainer.appendChild(countSpan);
  entryContainer.appendChild(countContainer);

  const title = document.createElement('div');
  title.classList.add('apW');
  title.setAttribute('role', 'heading');
  title.setAttribute('aria-level', '2');
  title.textContent = 'Pingojo';

  entryContainer.appendChild(title);

  entryContainer.addEventListener('click', () => {
    chrome.storage.sync.get("base_url", ({
      base_url
    }) => {
      
      var base_url = base_url || "https://www.pingojo.com";

    window.open(base_url + '/dashboard', '_blank');
  });
  });

  return entryContainer;
}

function addOrUpdatePingojoEntry(count) {
  const sidebar = document.querySelector('.aeN.WR.a6o.anZ.nH.oy8Mbf');
  if (!pingojoEntry) {
    pingojoEntry = createPingojoEntry(count);
    if (sidebar) {
      sidebar.appendChild(pingojoEntry);
    }
  } else {
    const countValue = pingojoEntry.querySelector('.XU');
    if (countValue) {
      countValue.textContent = count;
    }
  }
}

function observeSidebar() {
  const observer = new MutationObserver((mutations) => {
    const sidebar = document.querySelector('.aeN.WR.a6o.anZ.nH.oy8Mbf');
    if (sidebar) {
      addOrUpdatePingojoEntry(10); 
      observer.disconnect();
    }
  });

  const observerConfig = {
    childList: true,
    subtree: true,
  };

  observer.observe(document.body, observerConfig);
}




function addPingojoEntry(count) {
  const sidebar = document.querySelector('.aeN.WR.a6o.anZ.nH.oy8Mbf');
  if (sidebar) {
    const pingojoEntry = createPingojoEntry(count);
    sidebar.appendChild(pingojoEntry);
  }
}

function createButton(label, callback) {
  const button = document.createElement('button');
  button.textContent = label;
  button.style.margin = '5px';
  button.style.padding = '5px';
  button.style.backgroundColor = '#4285f4';
  button.style.color = 'white';
  button.style.border = 'none';
  button.style.borderRadius = '5px';
  button.style.cursor = 'pointer';
  button.onclick = callback;
  return button;
}



function addButtonAndInput() {
  const emailContainer = document.querySelector('.h7 [data-legacy-message-id]');
  const subjectElement = document.querySelector('h2[data-thread-perm-id]');
  const existingToolbar = document.querySelector('#company_input_field');
  if (existingToolbar) return;


  if (emailContainer && subjectElement) {
    const toolbar = document.createElement('div');
    toolbar.style.display = 'flex';
    toolbar.style.flexDirection = 'column';
    toolbar.style.alignItems = 'center';
    toolbar.style.padding = '10px';

    const inputContainer = document.createElement('div');
    inputContainer.style.display = 'flex';
    toolbar.appendChild(inputContainer);

    const inputField = document.createElement('input');
    inputField.setAttribute('id', 'role_input_field');
    inputField.style.marginRight = '10px';
    inputField.style.width = '100px';
    inputField.placeholder = 'Role';
    inputContainer.appendChild(inputField);

    const inputField2 = document.createElement('input');
    inputField2.setAttribute('id', 'company_input_field');
    inputField2.style.marginRight = '10px';
    inputField2.style.width = '100px';
    inputField2.placeholder = 'Company';
    inputContainer.appendChild(inputField2);

    const spinner = document.createElement('div');
    spinner.classList.add('spinner');
    spinner.style.display = 'none';
    toolbar.appendChild(spinner);
  
    const checkmark = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    checkmark.setAttribute('viewBox', '0 0 52 52');
    checkmark.classList.add('checkmark');
    checkmark.style.display = 'none';
    
    const checkmarkPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    checkmarkPath.setAttribute('d', 'M14.1 27.2l7.1 7.2 16.7-16.8');
    checkmarkPath.setAttribute('fill', 'none');
    checkmark.appendChild(checkmarkPath);
    
    toolbar.appendChild(checkmark);
    
    
    // Extract company name from email subject
    const subject = subjectElement.textContent;
    let companyName = "";
    for (const template of subjectTemplates) {
      const match = subject.match(template);
      if (match) {
        companyName = match[1];
        break;
      }
    }

    inputField2.value = companyName;

    const roleElement = document.querySelector('[aria-label="Job Title"]');
    if (roleElement && inputField) {
      const role = roleElement.querySelector('span')?.textContent;
      if (role) {
        inputField.value = role.trim();
      }
    }

    
const links = document.querySelectorAll('a');
let linkElement = null;

for (let i = 0; i < links.length; i++) {
  const link = links[i];
  const computedStyle = window.getComputedStyle(link);

  if (computedStyle.getPropertyValue('font-weight') === '600' && computedStyle.getPropertyValue('color') === 'rgb(5, 12, 38)') {
    linkElement = link;
    break;
  }
}

if (linkElement) {
  const roleName = linkElement.textContent.trim();
  inputField.value = roleName;
}



    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.marginTop = '10px';
    toolbar.appendChild(buttonContainer);


    const appliedButton = createDetailButton('Applied', spinner, checkmark);
    buttonContainer.appendChild(appliedButton);

    const scheduledButton = createDetailButton('Scheduled', spinner, checkmark);
    buttonContainer.appendChild(scheduledButton);

    const nextButton = createDetailButton('Next', spinner, checkmark);
    buttonContainer.appendChild(nextButton);

    const passedButton = createDetailButton('Passed', spinner, checkmark);
    buttonContainer.appendChild(passedButton);

    emailContainer.parentNode.insertBefore(toolbar, emailContainer);
  }
}

function injectStylesheet() {
  const cssLink = document.createElement('link');
  cssLink.rel = 'stylesheet';
  cssLink.type = 'text/css';
  cssLink.href = chrome.runtime.getURL('styles.css');
  document.head.appendChild(cssLink);
}

observeSidebar();
listenHashChanged();
injectStylesheet();
