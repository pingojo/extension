const waitForViewMessageLink = setInterval(() => {
  const elementsWithViewMessage = Array.from(document.querySelectorAll('*')).filter(element => element.textContent === 'View message');
  if (elementsWithViewMessage.length > 0) {
    clearInterval(waitForViewMessageLink);
    elementsWithViewMessage[0].click();
  }
}, 1000);



async function highlightCompanyNames() {
  let companyNames = await getCompanyNames();

  // Load application data
  const applications = await new Promise((resolve) => {
    chrome.storage.local.get('applications', ({ applications }) => {
      resolve(applications || []);
    });
  });

  // Map stage to corresponding color
  const stageColor = {
    'Applied': '8bc34a',
    'Scheduled': '03a9f4',
    'Next': 'ff9800',
    'Passed': 'f44336'
  };

  // filter out empty or whitespace-only company names
  companyNames = companyNames.filter(name => name.trim() !== '');

  function escapeRegExp(string) {
    return string.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&');
  }

  const pattern = companyNames.map(escapeRegExp).join('|');
  const regex = new RegExp(`\\b(?:${pattern})\\b`, 'gi');

  function highlightMatches(textNode) {
    let match;
    while ((match = regex.exec(textNode.data)) !== null) {
      const span = document.createElement('span');
      span.className = 'highlighted-company';

      const matchedText = match[0];
      const application = applications.find(app => app.company_name.toLowerCase() === matchedText.toLowerCase());

      if (application) {

        span.style.backgroundColor = '#' + stageColor[application.stage_name];
        span.style.color = '#ffffff';
        span.onclick = function() {
          const slug = matchedText.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '');
          window.open(`https://pingojo.com/company/${encodeURIComponent(slug)}/`, '_blank');
        }
      } else {
        span.style.backgroundColor = 'yellow';
      }

      const range = document.createRange();
      range.setStart(textNode, match.index);
      range.setEnd(textNode, match.index + matchedText.length);
      range.surroundContents(span);

      regex.lastIndex -= matchedText.length - 1;
    }
  }

  const treeWalker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    { acceptNode: (node) => (regex.test(node.data) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) },
    false
  );

  const nodesToHighlight = [];
  while (treeWalker.nextNode()) {
    nodesToHighlight.push(treeWalker.currentNode);
  }

  function processNodes() {
    const node = nodesToHighlight.shift();
    if (node) {
      highlightMatches(node);
      setTimeout(processNodes, 0);
    }
  }

  processNodes();
}


const style = document.createElement('style');
style.textContent = `
  .highlighted-company {
    background-color: yellow;
  }
`;
document.head.appendChild(style);

if (!window.location.href.includes("pingojo.com")) {
  highlightCompanyNames(); 
}

replaceLinkWithGmailLink();



async function getCompanyNames() {
  const applications = await getApplications();
  const companyNames = applications.map(app => app.company_name);
  return companyNames;
}

const observer = new MutationObserver(mutationsList => {
  for (const mutation of mutationsList) {
    if (mutation.type === 'childList' && mutation.addedNodes.length) {
      const addedNode = mutation.addedNodes[0];
      if (addedNode.tagName === 'DIV' && addedNode.getAttribute('role') === 'listitem') {
        debouncedAddButtonAndInput();

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



const subjectTemplates = [
  /Interview Invitation from (.*)/,
  /Interview Request from (.*)/,
  /Interview Opportunity with (.*)/,
  /Invitation to Interview at (.*)/,
  /(.*) Interview Invitation/,
  /(.*) - Application Update/,
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
  /Thank you for applying to (.*)/,
  /Thank you for your application to (.*?)(?:(?= for)|$)(?: for (.*))?/,
  /Regarding your application to (.*)/,
  /Your application to (.*)/,
  /Following up your (.*) application/,
  /Update regarding your application to (.*)/,
  /Your application with (.*)/,
  /Follow up on .* at (.*)/,
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
                    //print response code
                    alert('Network response was not ok 1' + JSON.stringify(response) + JSON.stringify(response.status));
                    throw new Error('Network response was not ok 2', JSON.stringify(response) + JSON.stringify(response.status));
                  }
                  return response.json();
                })
                .then(data => {
                  const counts = [
                    data.counts['total_applied'],
                    data.counts['total_scheduled'],
                    data.counts['total_next'],
                    data.counts['total_passed'],
                  ];

                  addOrUpdatePingojoEntry(counts)
                  resolve(data);

                  chrome.storage.local.get("applications", (data2) => {
                    let applications = data2.applications || [];

                    applications.push(payload);

                    chrome.storage.local.set({ applications }, () => {
                      //console.log("Applications stored:", applications);
                    });
                  });
                })
                .catch(error => {
                  alert('There was a problem with the fetch operation -- :' + JSON.stringify(error) + JSON.stringify(payload));
                  console.error('There was a problem with the fetch operation -- :'+ JSON.stringify(error) + JSON.stringify(payload));
                  reject(new Error(JSON.stringify(error)));
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


async function autoSubmitAppliedButton() {
  const elements = Array.from(document.querySelectorAll("*"));
  let found = false;
  for (let index = 0; index < elements.length; index++) {
    const element = elements[index];
    const text = element.textContent.toLowerCase();

    if (text.indexOf("your application has been submitted") !== -1) {
      found = false;

      const appliedButton = document.querySelector("#applied_button");
      if (appliedButton) {
        const inputField2 = document.querySelector('#company_input_field');
        let companyName = '';
        if (inputField2) {
          companyName = inputField2.value;
        }

        try {
          const companyNames = await getCompanyNames();
          for (let i = 0; i < companyNames.length; i++) {
            if (companyNames[i] === companyName) {
              found = true;
            }
          }
          if (!found) {
            appliedButton.click();
            found = true;
            break;  
          }
        } catch (err) {
          console.error("Error retrieving company names: ", err);
        }

      } else {
        //console.log("No applied button found");
      }
      if (found) break;
    }
  }
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
        button.style.backgroundColor = 'grey';

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

    const userNumber = (window.location.href.match(/\/u\/(\d+)/) || [, '0'])[1];

    img.addEventListener("click", (event) => {
      event.stopPropagation();
      window.location.href = `https://mail.google.com/mail/u/${userNumber}/#search/from:${fromAddress}`;
    });

    const td = document.createElement("td");
    td.style.verticalAlign = "middle";
    td.appendChild(img);

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
    debouncedAddButtonAndInput();
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

function createPingojoEntry(counts) {
  const entryContainer = document.createElement('div');
  entryContainer.classList.add('Xa', 'ZR', 'XT', 'adZ', 'Xr');
  entryContainer.style.display = 'flex';
  entryContainer.style.flexDirection = 'column';
  entryContainer.style.alignItems = 'center';

  const colors = ['#8bc34a', '#03a9f4', '#ff9800', '#f44336']; // green, blue, orange, and red

  const iconContainer = document.createElement('div');
  iconContainer.style.display = 'grid';
  iconContainer.style.gridTemplateColumns = '1fr 1fr';
  iconContainer.style.gridTemplateRows = '1fr 1fr';
  iconContainer.style.width = '48px';
  iconContainer.style.height = '48px';
  iconContainer.style.borderRadius = '8px';
  iconContainer.style.overflow = 'hidden';

  counts.forEach((count, index) => {
    const countContainer = document.createElement('div');
    countContainer.style.display = 'flex';
    countContainer.style.alignItems = 'center';
    countContainer.style.justifyContent = 'center';
    countContainer.style.backgroundColor = colors[index];
    countContainer.style.color = 'white';
    countContainer.style.fontSize = '14px';
    countContainer.style.fontWeight = 'bold';
    countContainer.setAttribute('aria-label', `Pingojo, ${count} items`);
    countContainer.setAttribute('role', 'link');
    countContainer.tabIndex = -1;
    const countValue = document.createElement('span');
    countValue.setAttribute('aria-hidden', 'true');
    countValue.textContent = count;
    countContainer.appendChild(countValue);
    iconContainer.appendChild(countContainer);
  });

  entryContainer.appendChild(iconContainer);
  const title = document.createElement('div');
  title.classList.add('apW');
  title.setAttribute('role', 'heading');
  title.setAttribute('aria-level', '2');
  title.textContent = 'Pingojo';
  title.style.textAlign = 'center';
  entryContainer.appendChild(title);
  entryContainer.addEventListener('click', () => {
    chrome.storage.sync.get("base_url", ({ base_url }) => {
      var base_url = base_url || "https://www.pingojo.com";
      window.open(base_url + '/dashboard', '_blank');
    });
  });

  return entryContainer;
}


function addOrUpdatePingojoEntry(counts) {
  const sidebar = document.querySelector('.aeN.WR.a6o.anZ.nH.oy8Mbf');
  if (!pingojoEntry) {
    pingojoEntry = createPingojoEntry(counts);
    if (sidebar) {
      sidebar.appendChild(pingojoEntry);
    }
  } else {
    counts.forEach((count, index) => {
      const countValue = pingojoEntry.querySelectorAll('span[aria-hidden="true"]')[index];
      if (countValue) {
        countValue.textContent = count;
      }
    });
  }
}

async function observeSidebar() {
  const counts = await fetchCountsAndApplicationsFromServer();
  const observer = new MutationObserver((mutations) => {
    const sidebar = document.querySelector('.aeN.WR.a6o.anZ.nH.oy8Mbf');
    if (sidebar) {
      addOrUpdatePingojoEntry(counts);
      observer.disconnect();
    }
  });

  const observerConfig = {
    childList: true,
    subtree: true,
  };

  observer.observe(document.body, observerConfig);
}

async function fetchCountsAndApplicationsFromServer() {
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
                method: 'GET',
                credentials: 'include',
                headers: headers
              })
                .then(response => {
                  if (!response.ok) {
                    alert('Network response was not ok 3', JSON.stringify(response));
                    throw new Error('Network response was not ok 4', JSON.stringify(response));
                  }
                  return response.json();
                })
                .then(data => {
                  const counts = [
                    data.counts['total_applied'],
                    data.counts['total_scheduled'],
                    data.counts['total_next'],
                    data.counts['total_passed'],
                  ];

                  const applications = data.emails.map(email => ({
                    gmail_id: email.gmail_id,
                    subject: email.subject,
                    company_name: email.company_name,
                    company_slug: email.company_slug,
                    job_link: email.job_link,
                    job_role: email.job_role,
                    stage_name: email.stage_name,
                  }));

                  chrome.storage.local.set({ applications }, () => {
                    //console.log('Applications stored:', applications);
                  });

                  resolve(counts);
                })
                .catch(error => {
                  alert('There was a problem with the fetch operation -- :' + JSON.stringify(error) + JSON.stringify(payload));
                  console.error('There was a problem with the fetch operation -- :'+ JSON.stringify(error) + JSON.stringify(payload));
                  reject(new Error(JSON.stringify(error)));
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


function addPingojoEntry(count) {
  const sidebar = document.querySelector('.aeN.WR.a6o.anZ.nH.oy8Mbf');
  if (sidebar) {
    const counts = [count, 15, 20, 25];
    const pingojoEntry = createPingojoEntry(counts);
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


function debounce(func, wait) {
  let timeout;
  return function (...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}

const debouncedAddButtonAndInput = debounce(addButtonAndInput, 500);

function addButtonAndInput() {
  const addToolbar = async () => {
    const emailContainer = document.querySelector('.h7 [data-legacy-message-id]');
    const subjectElement = document.querySelector('h2[data-thread-perm-id]');
    const existingToolbar = document.querySelector('#company_toolbar');

    if (existingToolbar) {
      existingToolbar.remove(); // Remove the toolbar
    }

    if (emailContainer && subjectElement) {
      const currentTab = await getCurrentTab();
      const toolbar = createToolbar();
      const url = currentTab.url;
      const gmailIdMatch = url.match(/\/([a-zA-Z0-9]+)$/);
      const gmailId = gmailIdMatch ? gmailIdMatch[1] : null;
      const applications = await getApplications();
      const application = applications.find(app => app.gmail_id === gmailId);

      if (application) {
        setInputValues(toolbar, application);
        setButtonState(toolbar, application);
      } else {
        setDefaultInputValues(toolbar, subjectElement);
      }

      emailContainer.parentNode.insertBefore(toolbar, emailContainer);

      autoSubmitAppliedButton();
    } else {
      //console.log('emailContainer && subjectElement not found');
    }
  };
  setTimeout(addToolbar, 100);
}

function getCurrentTab() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: 'getCurrentTab' }, (currentTab) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(currentTab);
      }
    });
  });
}


async function getApplications() {
  return new Promise((resolve) => {
    chrome.storage.local.get('applications', ({ applications }) => {
      resolve(applications || []);
    });
  });
}

function setInputValues(toolbar, application) {
  const roleInput = toolbar.querySelector('#role_input_field');
  const companyInput = toolbar.querySelector('#company_input_field');
  if (application.job_role) {
    roleInput.value = application.job_role;
  }

  companyInput.value = application.company_name;
  const buttonContainer = toolbar.querySelector('.button_container');
  const linkToCrm = createLinkToCrm(companyInput.value);
  buttonContainer.appendChild(linkToCrm);
}

function setButtonState(toolbar, application) {
  const stageButton = toolbar.querySelector(`#${application.stage_name.toLowerCase()}_button`);
  const otherButtons = toolbar.querySelectorAll('.stage_button:not(#' + application.stage_name.toLowerCase() + '_button)');

  if (stageButton) {
    stageButton.style.backgroundColor = 'grey';
  } else {
    console.error('Stage button not found:', application.stage_name);
  }

  otherButtons.forEach(button => button.style.backgroundColor = '');
}


function setDefaultInputValues(toolbar, subjectElement) {
  const roleInput = toolbar.querySelector('#role_input_field');
  const companyInput = toolbar.querySelector('#company_input_field');
  const subject = subjectElement.textContent;

  let companyName = "";
  for (const template of subjectTemplates) {
    const match = subject.match(template);
    if (match) {
      companyName = match[1];
      break;
    }
  }

  companyInput.value = companyName;

  const roleElement = document.querySelector('[aria-label="Job Title"]');
  if (roleElement && roleInput) {
    const role = roleElement.querySelector('span')?.textContent;
    if (role) {
      roleInput.value = role.trim();
    }
  }

  const linkElement = findLinkElement();
  if (linkElement) {
    const roleName = linkElement.textContent.trim();
    roleInput.value = roleName;
  }

  const buttonContainer = toolbar.querySelector('.button_container');
  const linkToCrm = createLinkToCrm(companyName);
  buttonContainer.appendChild(linkToCrm);
}

function createLinkToCrm(companyName) {
  const linkToCrm = document.createElement('a');
  if (companyName) {
    linkToCrm.setAttribute('href', 'https://mail.google.com/mail/u/0/#search/' + companyName);
    linkToCrm.textContent = companyName;
  }
  return linkToCrm;
}


function findLinkElement() {
  const links = document.querySelectorAll('a');

  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    const computedStyle = window.getComputedStyle(link);

    if (computedStyle.getPropertyValue('font-weight') === '600' && computedStyle.getPropertyValue('color') === 'rgb(5, 12, 38)') {
      return link;
    }
  }

  return null;
}

function createToolbar() {
  const toolbar = document.createElement('div');
  toolbar.setAttribute('id', 'company_toolbar');
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
  inputField.style.width = '150px';
  inputField.placeholder = 'Role';
  inputContainer.appendChild(inputField);

  const inputField2 = document.createElement('input');
  inputField2.setAttribute('id', 'company_input_field');
  inputField2.style.marginRight = '10px';
  inputField2.style.width = '200px';
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

  const buttonContainer = document.createElement('div');
  buttonContainer.classList.add('button_container');
  buttonContainer.style.display = 'flex';
  buttonContainer.style.marginTop = '10px';
  toolbar.appendChild(buttonContainer);

  const appliedButton = createDetailButton('Applied', spinner, checkmark);
  appliedButton.id = 'applied_button';
  buttonContainer.appendChild(appliedButton);

  const scheduledButton = createDetailButton('Scheduled', spinner, checkmark);
  scheduledButton.id = 'scheduled_button';
  buttonContainer.appendChild(scheduledButton);

  const nextButton = createDetailButton('Next', spinner, checkmark);
  nextButton.id = 'next_button';
  buttonContainer.appendChild(nextButton);

  const passedButton = createDetailButton('Passed', spinner, checkmark);
  passedButton.id = 'passed_button';
  buttonContainer.appendChild(passedButton);

  return toolbar;
}

function injectStylesheet() {
  const cssLink = document.createElement('link');
  cssLink.rel = 'stylesheet';
  cssLink.type = 'text/css';
  cssLink.href = chrome.runtime.getURL('styles.css');
  document.head.appendChild(cssLink);
}

const currentURL = window.location.href;

const siteFunctions = {
  'mail.google.com': function () {
    observer.observe(targetNode, observerConfig);
    observeSidebar();
    listenHashChanged();
    injectStylesheet();
  },
  'greenhouse.io': function () {
    if (isJobListing()) {
      createOverlay("greenhouse");
    }
  },
  'wellfound.com': function () {
    if (isWellfoundJobListing()) {
      createOverlay("wellfound");
    }
  }
};




let emailRegEx = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

function searchElement(element) {
  let matches = [];

  for (let i = 0; i < element.attributes.length; i++) {
    let attrMatches = element.attributes[i].value.match(emailRegEx);
    if (attrMatches) {
      attrMatches.forEach(match => {
        if (!matches.includes(match)) {
          console.log(match);
          if (!match.includes("u003e")) {
            matches.push(match);
          }
        }
      });
    }
  }

  // Check text content of the element
  let textMatches = element.textContent.match(emailRegEx);
  if (textMatches) {
    textMatches.forEach(match => {
      if (!matches.includes(match)) {
        if (!match.includes("u003e")) {
          matches.push(match);
        }
      }
    });
  }

  // Check children of the element
  for (let i = 0; i < element.children.length; i++) {
    let childMatches = searchElement(element.children[i]);
    childMatches.forEach(match => {
      if (!matches.includes(match)) {
        if (!match.includes("u003e")) {
          matches.push(match);
        }
      }
    });
  }

  return matches;
}


function isWellfoundJobListing() {
  const element = document.getElementById("__NEXT_DATA__");
  if (element !== null) {
    const json_data = element.textContent;
    return currentURL.includes("/jobs/");
  }
  return false;
}

function isJobListing() {
  const scriptTags = document.getElementsByTagName('script');
  for (const scriptTag of scriptTags) {
    if (scriptTag.type === 'application/ld+json') {
      const data = JSON.parse(scriptTag.textContent);
      if (data['@type'] === 'JobPosting') {
        return true;
      }
    }
  }
  return false;
}

function replaceLinkWithGmailLink() {
  const link = document.querySelector("#stat a");
  if (link) {
    const gmailLink = document.createElement("a");
    gmailLink.href = "https://mail.google.com/";
    gmailLink.textContent = "Open Gmail";
    gmailLink.target = "_blank"; // Add target attribute to open in new window
    link.replaceWith(gmailLink);
  }
}

function traverseAndPrint(jsonObj) {
  let job_url = "";
  const result = {};
  if (jsonObj !== null && typeof jsonObj == "object") {
    Object.entries(jsonObj).forEach(([key, value]) => {
      if (key == "structuredData") {
        if (value !== null) {
          new_json_obj = JSON.parse(value);
          result.hiringOrganizationName = new_json_obj.hiringOrganization.name;
          result.hiringOrganizationSameAs = new_json_obj.hiringOrganization.sameAs;
          result.title = new_json_obj.title;
          result.description = new_json_obj.description;
          result.datePosted = new Date(new_json_obj.datePosted).toISOString().slice(0, 10);
          result.validThrough = new Date(new_json_obj.validThrough).toISOString().slice(0, 10);

        }
      }
      if (key == "ogUrl") {
        if (value && value.includes("jobs/")) {
          result.ogUrl = value;
          job_url = value;
        }
      }
      if (typeof value === 'object' && value !== null) {
        const subResult = traverseAndPrint(value);
        Object.assign(result, subResult);
      }
    });
  }
  return result;
}

function extractWellfoundJobInfo() {



  const json_data = document.getElementById("__NEXT_DATA__").textContent;

  jsonObj = JSON.parse(json_data);
  returned_data = traverseAndPrint(jsonObj);

  const jobInfo = {};

  if (returned_data !== null && typeof returned_data == "object") {

    jobInfo.title = returned_data.title;
    jobInfo.website = returned_data.hiringOrganizationSameAs;
    jobInfo.company = returned_data.hiringOrganizationName;
    jobInfo.datePosted = returned_data.datePosted;
    jobInfo.description = returned_data.description;
  }

  if (!jobInfo.title) {
    const titleElement = document.querySelector(".app-title");
    if (titleElement) {
      jobInfo.title = titleElement.textContent.trim();
    }
  }

  if (!jobInfo.company) {
    const companyNameElement = document.querySelector(".company-name");
    if (companyNameElement) {
      jobInfo.company = companyNameElement.textContent.trim().substring(3);
    }
  }

  if (!jobInfo.location) {
    const locationElement = document.querySelector(".location");
    if (locationElement) {
      jobInfo.location = locationElement.textContent.trim();
    }
  }

  const bodyContent = document.body.textContent;
  const salaryRangeRegex = /.*?(\$[0-9,]+k?(?:\.\d{2})?).*?(\$[0-9,]+k?(?:\.\d{2})?)/;

  const salaryRangeMatch = bodyContent.match(salaryRangeRegex);

  if (salaryRangeMatch) {
    let minSalary = salaryRangeMatch[1].includes('k') ? parseFloat(salaryRangeMatch[1].replace(/[$,k]/g, '')) * 1000 : parseFloat(salaryRangeMatch[1].replace(/[$,]/g, ''));
    let maxSalary = salaryRangeMatch[2].includes('k') ? parseFloat(salaryRangeMatch[2].replace(/[$,k]/g, '')) * 1000 : parseFloat(salaryRangeMatch[2].replace(/[$,]/g, ''));

    jobInfo.salaryRange = `$${minSalary} - $${maxSalary}`;
  }
  return jobInfo;

}

function extractGreenhouseJobInfo() {
  const jobInfo = {};

  const scriptTags = document.getElementsByTagName('script');
  for (const scriptTag of scriptTags) {
    if (scriptTag.type === 'application/ld+json') {
      const data = JSON.parse(scriptTag.textContent);
      if (data['@type'] === 'JobPosting') {
        jobInfo.title = data.title;
        jobInfo.company = data.hiringOrganization.name;
        jobInfo.location = data.jobLocation.address.addressLocality;
        jobInfo.datePosted = data.datePosted;
        jobInfo.description = data.description;
        break;
      }
    }
  }

  if (!jobInfo.title) {
    const titleElement = document.querySelector(".app-title");
    if (titleElement) {
      jobInfo.title = titleElement.textContent.trim();
    }
  }

  if (!jobInfo.company) {
    const companyNameElement = document.querySelector(".company-name");
    if (companyNameElement) {
      jobInfo.company = companyNameElement.textContent.trim().substring(3);
    }
  }

  if (!jobInfo.location) {
    const locationElement = document.querySelector(".location");
    if (locationElement) {
      jobInfo.location = locationElement.textContent.trim();
    }
  }

  const bodyContent = document.body.textContent;
  const salaryRangeRegex = /.*?(\$[0-9,]+(?:\.\d{2})?).*?(\$[0-9,]+(?:\.\d{2})?)/;
  const salaryRangeMatch = bodyContent.match(salaryRangeRegex);
  if (salaryRangeMatch) {
    jobInfo.salaryRange = `${salaryRangeMatch[1]} - ${salaryRangeMatch[2]}`;
  }

  return jobInfo;
}

async function sendJobInfoToBackend(jobInfo) {
  jobInfo.link = window.location.href;



  chrome.storage.sync.get("base_url", ({ base_url }) => {
    var base_url = base_url || "https://www.pingojo.com";
    var full_url = base_url + "/api/add_job/";
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
              body: JSON.stringify(jobInfo),
            })
              .then(response => {
                if (!response.ok) {
                  alert('Network response was not ok 5', JSON.stringify(response));
                  throw new Error('Network response was not ok 6', JSON.stringify(response));
                }
                return response.json();
              }).catch(error => {
                jobInfo.description = "removed jd";
                alert('There was a problem with the fetch operation it may be a cors issue -- :' + error + JSON.stringify(jobInfo));
                console.error('There was a problem with the fetch operation it may be a cors issue -- :'+ error + JSON.stringify(jobInfo));
                reject(new Error(JSON.stringify(error)));
              }).then(data => {

                //console.log(data);
              })
              .catch(error => {
                jobInfo.description = "removed jd";
                alert('There was a problem with the data operation -- :' + JSON.stringify(error) + JSON.stringify(jobInfo));
                console.error('There was a problem with the data operation -- :'+ JSON.stringify(error) + JSON.stringify(jobInfo));
                reject(new Error(JSON.stringify(error)));

              });
          } else {
            console.error('Session cookie not found');
            window.location = base_url + '/accounts/login/?from=gmail';

          }
        });
      } else {
        console.error('Session cookie not found');
        window.location = base_url + '/accounts/login/?from=gmail';

      }
    });
  });
}

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
}


async function createOverlay(jobsite) {

  const overlay = document.createElement("div");
  overlay.id = "job-data-extractor-overlay";
  overlay.style.position = "fixed";
  overlay.style.top = "100px";
  overlay.style.right = "0";
  overlay.style.width = "300px";
  overlay.style.height = "70%";
  overlay.style.backgroundColor = "white";
  overlay.style.zIndex = "10000";
  overlay.style.overflowY = "auto";
  overlay.style.padding = "10px";
  overlay.style.boxShadow = "0 0 10px rgba(0, 0, 0, 0.2)";
  document.body.appendChild(overlay);
  
  // Add event listeners for dragging the overlay
  let isDragging = false;
  let initialX;
  let initialY;
  let currentX;
  let currentY;
  let xOffset = 0;
  let yOffset = 0;
  
  overlay.addEventListener("mousedown", dragStart);
  document.addEventListener("mousemove", drag);
  document.addEventListener("mouseup", dragEnd);
  
  function dragStart(event) {
    initialX = event.clientX - xOffset;
    initialY = event.clientY - yOffset;
  
    if (event.target === overlay) {
      isDragging = true;
    }
  }
  
  function drag(event) {
    if (isDragging) {
      event.preventDefault();
  
      currentX = event.clientX - initialX;
      currentY = event.clientY - initialY;
  
      xOffset = currentX;
      yOffset = currentY;
  
      setTranslate(currentX, currentY, overlay);
    }
  }
  
  function dragEnd(event) {
    initialX = currentX;
    initialY = currentY;
  
    isDragging = false;
  }
  
  function setTranslate(xPos, yPos, el) {
    el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
  }
  
  var jobInfo = {};

  if(jobsite === "wellfound"){
    jobInfo = extractWellfoundJobInfo();
  }else if(jobsite === "greenhouse"){
    jobInfo = extractGreenhouseJobInfo();
  }
  const emails = searchElement(document.body);
  const form = document.createElement("form");
  form.id = "job-data-extractor-form";
  overlay.appendChild(form);


  for (const key in jobInfo) {
    const label = document.createElement("label");
    label.htmlFor = `job-data-extractor-${key}`;
    label.textContent = `${key.charAt(0).toUpperCase() + key.slice(1)}:`;
    form.appendChild(label);

    const input = document.createElement("input");
    input.id = `job-data-extractor-${key}`;
    input.type = "text";
    input.value = jobInfo[key];
    input.style.width = "100%";
    input.style.marginBottom = "10px";
    form.appendChild(input);
  }
  const emailsfound = document.createElement("div");
  let updatedEmails = []

  chrome.storage.sync.get("email_address", ({ email_address }) => {
    if (email_address) {
      updatedEmails = emails.filter(email => email !== email_address);
      if (updatedEmails.length > 0) {
        console.log('we are adding the emails');
        String(updatedEmails).split(',').forEach(email => {
          const emailLink = document.createElement('a');
          emailLink.classList.add('emaillink');
          emailLink.href = `https://mail.google.com/mail/u/0/?view=cm&fs=1&to=${email.trim()}&tf=1`;
          emailLink.target = '_blank';
          emailLink.textContent = email;
          const lineBreak = document.createElement('br');

          emailsfound.appendChild(emailLink);
          emailsfound.appendChild(lineBreak);

          emailsfound.style.width = "100%";
          emailsfound.style.marginBottom = "10px";
          emailsfound.style.border = "1px solid red";

          form.appendChild(emailsfound);

        });

      }
    }
  });

  const pingojoLink = document.createElement("a");
  pingojoLink.href = "https://www.pingojo.com/search/?search=" + jobInfo.company;
  pingojoLink.target = "_blank";
  pingojoLink.textContent = "Search " + jobInfo.company + " on Pingojo";
  pingojoLink.style.display = "block";
  pingojoLink.style.marginBottom = "10px";
  form.appendChild(pingojoLink);

  const gmailLink = document.createElement("a");
  gmailLink.href = "https://mail.google.com/mail/u/0/#search/" + '"' + jobInfo.company + '"';
  gmailLink.target = "_blank";
  gmailLink.textContent = "Search Gmail for " + jobInfo.company;
  gmailLink.style.display = "block";
  gmailLink.style.marginBottom = "10px";
  form.appendChild(gmailLink);
  
  if(jobsite === "wellfound"){
    const url = new URL(jobInfo.website);
    const domain = url.hostname.replace("www.", "");
  
  
    const googleLink = document.createElement("a");
    googleLink.href = `https://www.google.com/search?q=site:${domain}+*@${domain}`;
    googleLink.target = "_blank";
    googleLink.textContent = `Search Google for email ${jobInfo.company}`;
    googleLink.style.display = "block";
    googleLink.style.marginBottom = "10px";
    form.appendChild(googleLink);
  }

  if (jobInfo.website) {
    const websiteLink = document.createElement("a");
    websiteLink.href = jobInfo.website;
    websiteLink.target = "_blank";
    websiteLink.textContent = "Visit " + jobInfo.company + " website";
    websiteLink.style.display = "block";
    websiteLink.style.marginBottom = "10px";
    form.appendChild(websiteLink);

  }

  chrome.storage.sync.get("prompt_text", ({ prompt_text }) => {
    var prompt_text = prompt_text || "Create a cover letter for:";
    const copyToClipboardButton = document.createElement("button");
    copyToClipboardButton.textContent = "Copy Prompt to Clipboard";
    copyToClipboardButton.style.marginBottom = "10px";

    const copyToClipboardInput = document.createElement("input");
    copyToClipboardInput.style.display = "none";
    form.appendChild(copyToClipboardButton);

    copyToClipboardButton.addEventListener("click", (event) => {
      event.preventDefault();

      var hiringContactDiv = document.querySelector("div[class*='recruitingContact']");

      if (hiringContactDiv) {
        var hiringContact = hiringContactDiv.querySelector("a[href*='/u/']");


        if (hiringContact) {
          var hiringContactName = hiringContact.textContent;
          prompt_text += " Address the cover letter to " + hiringContactName + "\n\n";
        }
      }

      if (updatedEmails.length > 0) {
        prompt_text += " also add a subject for email\n\n";
      }

      const descriptionInput = document.getElementById("job-data-extractor-description");
      copyToClipboardInput.value = prompt_text + "\n\n the following is the information about the job, use it to generate the cover letter: " + descriptionInput.value;

      copyToClipboardInput.select();

      navigator.clipboard.writeText(copyToClipboardInput.value)
        .then(() => {
          copyToClipboardButton.textContent = "✓ Copied to Clipboard";
          window.open("https://chat.openai.com/", "_blank");

        })
        .catch(err => {
          copyToClipboardButton.textContent = "Something went wrong" + err;
        });
    });
    form.appendChild(copyToClipboardButton);
  });


  sendJobInfoToBackend(jobInfo);

  applications = await getApplications();

  const company = jobInfo.company;
  const application = applications.find(application => application.company_name.toLowerCase() === company.toLowerCase());
  if (application) {
    const applicationInfo = document.createElement("div");
    applicationInfo.style.marginBottom = "10px";
    applicationInfo.style.padding = "10px";
    applicationInfo.style.border = "1px solid #ccc";
    applicationInfo.style.borderRadius = "5px";
    applicationInfo.style.backgroundColor = "#eee";
    applicationInfo.textContent = `You have already applied to ${application.job_role} at ${application.company_name} stage: ${application.stage_name}.`;

    const colors = ['#8bc34a', '#03a9f4', '#ff9800', '#f44336']; // green, blue, orange, and red

    if (application.stage_name === 'Applied') {
      applicationInfo.style.backgroundColor = colors[0]
    } else if (application.stage_name === 'Scheduled') {
      applicationInfo.style.backgroundColor = colors[1]
    } else if (application.stage_name === 'Next') {
      applicationInfo.style.backgroundColor = colors[2]
    } else if (application.stage_name === 'Passed') {
      applicationInfo.style.backgroundColor = colors[3]
    }


    form.appendChild(applicationInfo);
  }



  const submitButton = document.createElement("button");
  submitButton.type = "submit";
  submitButton.style.display = "block";
  submitButton.style.marginTop = "10px";
  submitButton.textContent = "Submit";
  form.appendChild(submitButton);
}


for (const site in siteFunctions) {
  if (currentURL.includes(site)) {
    siteFunctions[site]();
    break;
  }
}


if (!window.location.href.includes("pingojo.com")) {
  const emails = searchElement(document.body);

  if (emails.length > 0) {
    const newDiv = document.createElement("div");
    newDiv.id = "email-notification";

    newDiv.style.position = "fixed";
    newDiv.style.top = "100px";
    newDiv.style.right = "0px";
    newDiv.style.zIndex = "1000";
    newDiv.style.padding = "10px";
    newDiv.style.backgroundColor = "#a8dadc";
    newDiv.style.color = "black";

    const closeButton = document.createElement("button");
    closeButton.textContent = "Close";
    closeButton.style.marginTop = "10px";
    closeButton.addEventListener("click", () => {
      newDiv.remove();
    });

    newDiv.appendChild(closeButton);

    const emailList = document.createElement("ul");
    chrome.storage.sync.get("email_address", ({ email_address }) => {
      
      emails.forEach(email => {
        if (!email.includes(email_address) && (email !== "info@example.com")) {
          let li = document.createElement("li");
          li.textContent = email;
          emailList.appendChild(li);
        }
      });

      if(emailList.children.length > 0){
        newDiv.appendChild(emailList);
        document.body.appendChild(newDiv);
      }
    });
  }
}