const colors = ['#8bc34a', '#03a9f4', '#ff9800', '#f44336']; // green, blue, orange, and red

const waitForViewMessageLink = setInterval(() => {
  const elementsWithViewMessage = Array.from(document.querySelectorAll('*')).filter(element => element.textContent === 'View message');
  if (elementsWithViewMessage.length > 0) {
    clearInterval(waitForViewMessageLink);
    elementsWithViewMessage[0].click();
  }
}, 1000);

async function highlightCompanyNames() {
  let companyNames = await getCompanyNames();

  const applications = await new Promise((resolve) => {
    chrome.storage.local.get('applications', ({ applications }) => {
      resolve(applications || []);
    });
  });

  const stageColor = {
    'Applied': '8bc34a',
    'Scheduled': '03a9f4',
    'Next': 'ff9800',
    'Passed': 'f44336'
  };

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
        span.onclick = function () {
          const slug = matchedText.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '');
          window.open(`https://pingojo.com/company/${encodeURIComponent(slug)}/`, '_blank');
        }
      } else {
        span.style.backgroundColor = 'yellow';
      }

      const range = document.createRange();
      range.setStart(textNode, match.index);
      range.setEnd(textNode, match.index + matchedText.length);
      try {
        range.surroundContents(span);
      }
      catch (err) {
        // console.log(err);
      }

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
  /Thanks for applying to (.*)!/,
  /Thank you for your application to (.*?)(?:(?= for)|$)(?: for (.*))?/,
  /Regarding your application to (.*)/,
  /Your application to (.*)/,
  /Following up your (.*) application/,
  /Update regarding your application to (.*)/,
  /Your application with (.*)/,
  /Follow up on .* at (.*)/,
];

observer.observe(document.body, observerConfig);

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

function sendDataToDRF(stage, domain, nameEmail, companyName, datetime, fromAddress, gmailId, roleName, inputCompanyEmail) {
  const payload = {
    company_name: companyName,
    stage_name: stage,
    source_domain: domain,
    source_email: nameEmail.email,
    to_email: inputCompanyEmail,
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

                  const checkmarkCount = document.querySelector('#checkmark_count');
                  if (checkmarkCount) {
                    checkmarkCount.textContent = parseInt(data.today_count);
                  }

                  addOrUpdatePingojoEntry(counts)
                  resolve(data);

                  chrome.storage.local.get("applications", (data2) => {
                    let applications = data2.applications || [];

                    chrome.storage.local.set({ application_count: data2.applications.length });
                    chrome.storage.local.set({ last_update: new Date().getTime() });

                    applications.push(payload);

                    chrome.storage.local.set({ applications }, () => {
                    });
                  });
                })
                .catch(error => {
                  alert('sendDataToDRF There was a problem with the fetch operation -- :' + JSON.stringify(error) + JSON.stringify(data) + JSON.stringify(payload));
                });
            } else {
              window.location = base_url + '/accounts/login/?from=gmail';
            }
          });
        } else {
          window.location = base_url + '/accounts/login/?from=gmail';
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
      if (inputField2.value) {
        companyName = inputField2.value;
      } else {
        alert('Company name is required');
        reject(new Error('Company name is required'));
      }
    }

    const inputFieldRole = document.querySelector('#role_input_field');
    let roleName = '';
    if (inputFieldRole) {
      if (inputFieldRole.value) {
        roleName = inputFieldRole.value;
      } else {
        alert('Role is required');
        reject(new Error('Role is required'));
      }
    }
    const inputCompanyEmail = document.querySelector('#company_email_input_field')
    let CompanyEmail = '';
    if (inputCompanyEmail) {
      if (inputCompanyEmail.value) {
        CompanyEmail = inputCompanyEmail.value;
      } else {
        alert('Company email is required');
        reject(new Error('Company email is required'));
      }
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

        sendDataToDRF(stage, nameEmail, domain, companyName, cleanedDatetime, fromAddress, gmailId, roleName, CompanyEmail)
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

// Helper function to convert rgb to hex
function rgbToHex(rgb) {
  const match = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
  if (!match) {
    // Handle the case where rgb string does not match the expected pattern
    console.error('Invalid RGB value:', rgb);
    return '#000000'; // Return a default color (black) or handle it as needed
  }
  function hex(x) {
    return ("0" + parseInt(x).toString(16)).slice(-2);
  }
  return "#" + hex(match[1]) + hex(match[2]) + hex(match[3]);
}

async function autoSubmitAppliedButton() {
  const emailContainer = document.querySelector('.h7 [data-legacy-message-id]');

  if (emailContainer) {
    const emailMetaInfo = emailContainer.querySelector('.gE.iv.gt');
    const fromEmailElement = emailMetaInfo.querySelector('.go');
    let fromAddress = fromEmailElement ? fromEmailElement.textContent : '';
    if (!fromAddress) {
      fromAddress = emailMetaInfo.querySelector('.gD').getAttribute('email');
    }

    chrome.storage.sync.get("email_address", async ({ email_address }) => {
      if (fromAddress.indexOf('wellfound') !== -1 || (email_address && fromAddress.indexOf(email_address) !== -1) || fromAddress.indexOf('mailer-daemon') !== -1) {
        const elements = Array.from(document.querySelectorAll("*"));
        let found = false;

        for (let index = 0; index < elements.length && !found; index++) {
          const element = elements[index];
          const text = element.textContent.toLowerCase();
          if (text.indexOf("your application has been submitted") !== -1 || (text.indexOf("i wanted to follow up on my application") !== -1 && fromAddress.indexOf('mailer-daemon') === -1)) {
            const appliedButton = document.querySelector("#applied_button");
            if (appliedButton) {
              const inputField2 = document.querySelector('#company_input_field');
              const companyName = inputField2 ? inputField2.value : '';

              try {
                const companyNames = await getCompanyNames();
                found = companyNames.includes(companyName);

                if (!found && companyName !== '') {
                  appliedButton.click();
                  found = true;
                }

                if (found && text.indexOf("i wanted to follow up on my application") !== -1) {
                  const toolbar = document.querySelector('#company_toolbar');
                  const scheduledButton = toolbar.querySelector('#scheduled_button');
                  const nextButton = toolbar.querySelector('#next_button');
                  const passedButton = toolbar.querySelector('#passed_button');

                  // Delay to ensure styles are computed
                  setTimeout(() => {
                    const bgColorApplied = window.getComputedStyle(appliedButton).backgroundColor;
                    const hexColorApplied = rgbToHex(bgColorApplied);
                    const bgColorScheduled = window.getComputedStyle(scheduledButton).backgroundColor;
                    const hexColorScheduled = rgbToHex(bgColorScheduled);
                    const bgColorNext = window.getComputedStyle(nextButton).backgroundColor;
                    const hexColorNext = rgbToHex(bgColorNext);
                    const bgColorPassed = window.getComputedStyle(passedButton).backgroundColor;
                    const hexColorPassed = rgbToHex(bgColorPassed);

                    if (hexColorApplied !== '#8bc34a' && hexColorScheduled !== '#03a9f4' && hexColorNext !== '#ff9800' && hexColorPassed !== '#f44336') {
                      appliedButton.click();
                    }

                    if (appliedButton) {
                      const observer = new MutationObserver((mutationsList, observer) => {
                        for (let mutation of mutationsList) {
                          const bgColor = window.getComputedStyle(appliedButton).backgroundColor;
                          const hexColor = rgbToHex(bgColor);

                          if (mutation.type === 'attributes' && hexColor === '#8bc34a') {
                            setTimeout(function () {
                              window.close();
                            }, 2000);
                            observer.disconnect();
                          }
                        }
                      });
                      observer.observe(appliedButton, { attributes: true, childList: false, subtree: false });
                    }
                  }, 100);  // Adjust the delay as needed
                }
              } catch (err) {
                console.error(err);
              }
            }
          }
        }
      }
    });
  }
}

function createDetailButton(label, spinner, checkmark) {
  const button = document.createElement('button');
  button.textContent = label;
  button.style.margin = '5px';
  button.style.padding = '5px';
  button.style.backgroundColor = '#ccc';
  button.style.color = 'white';
  button.style.border = 'none';
  button.style.borderRadius = '5px';
  button.style.cursor = 'pointer';
  button.style.fontWeight = 'bold';

  button.addEventListener("mouseover", function () {
    if (label === 'Applied') {
      button.style.backgroundColor = colors[0];
    } else if (label === 'Scheduled') {
      button.style.backgroundColor = colors[1];
    } else if (label === 'Next') {
      button.style.backgroundColor = colors[2];
    } else {
      button.style.backgroundColor = colors[3];
    }
  });
  button.addEventListener("mouseout", function () {
    if (button.style.border !== '1px solid rgb(0, 0, 0)') {
      button.style.backgroundColor = '#ccc';
    }
  });

  button.onclick = function () {
    spinner.style.display = 'block';
    sendDetailInfoToDRF(label)
      .then(() => {
        spinner.style.display = 'none';
        checkmark.style.display = 'block';

        
        const checkmarkCount = document.querySelector('#checkmark_count');
        if (checkmarkCount) {
          checkmarkCount.style.display = 'block';
        }


        toolbar = document.querySelector('#company_toolbar');
        toolbar.querySelector('#applied_button').style.border = 'none';
        toolbar.querySelector('#scheduled_button').style.border = 'none';
        toolbar.querySelector('#next_button').style.border = 'none';
        toolbar.querySelector('#passed_button').style.border = 'none';

        toolbar.querySelector('#applied_button').style.backgroundColor = '#ccc';
        toolbar.querySelector('#scheduled_button').style.backgroundColor = '#ccc';
        toolbar.querySelector('#next_button').style.backgroundColor = '#ccc';
        toolbar.querySelector('#passed_button').style.backgroundColor = '#ccc';

        if (label === 'Applied') {
          button.style.backgroundColor = colors[0]
        } else if (label === 'Scheduled') {
          button.style.backgroundColor = colors[1]
        } else if (label === 'Next') {
          button.style.backgroundColor = colors[2]
        } else if (label === 'Passed') {
          button.style.backgroundColor = colors[3]
        }
        button.style.border = '1px solid #000';
        var companySlug = "";
        var companyName = "";
        chrome.storage.local.get('applications', function (result) {
          const applications = result.applications;
          companyName = document.querySelector('#company_input_field').value;
          let isMatchFound = false;

          for (let i = 0; i < applications.length; i++) {
            if (applications[i].company_name === companyName) {
              applications[i].stage_name = label;
              isMatchFound = true;
              companySlug = applications[i].company_slug;
              const roleInput = document.querySelector('#role_input_field');
              if (roleInput) {
                applications[i].role_name = roleInput.value;
              }
            }
          }

          if (isMatchFound) {
            chrome.storage.local.set({ 'applications': applications }, function () {
            });
          }
        });

        const buttonContainer = toolbar.querySelector('.button_container');
        const linkToCrm = createLinkToCrm(companyName);
        buttonContainer.appendChild(linkToCrm);

        if (companySlug !== "") {
          const linkToPingojo = document.createElement('a');
          linkToPingojo.setAttribute('href', 'https://pingojo.com/company/' + companySlug);
          linkToPingojo.textContent = "View comp: " + companyName + " on Pingojo";
          buttonContainer.appendChild(linkToPingojo);
        } else {
          if (companyName) {
            const linkToPingojo = document.createElement('a');
            linkToPingojo.setAttribute('href', 'https://pingojo.com/?search=' + companyName);
            linkToPingojo.textContent = "Search for " + companyName + " on Pingojo";
            buttonContainer.appendChild(linkToPingojo);
          }
        }
      })
      .catch((error) => {
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
    countContainer.style.fontSize = '10px';
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
      window.open(base_url + '/dashboard/?stage=Applied', '_blank');
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
                'Permissions-Policy': 'ch-ua-form-factor',
              }
              fetch(full_url, {
                method: 'GET',
                credentials: 'include',
                headers: headers
              })
                .then(response => {
                  if (!response.ok) {
                    alert('Network response was not ok 3' + JSON.stringify(response) + JSON.stringify(response.status));
                    throw new Error('Network response was not ok 4', JSON.stringify(response) + JSON.stringify(response.status));
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
                  });

                  resolve(counts);
                })
                .catch(error => {
                  alert('fetchCountsAndApplicationsFromServer There was a problem with the fetch operation -- :' + JSON.stringify(error));
                });
            } else {
              window.location = base_url + '/accounts/login/?from=gmail';
            }
          });
        } else {
          window.location = base_url + '/accounts/login/?from=gmail';
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
      existingToolbar.remove();
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

      const toolbarButton = document.createElement('button');
      toolbarButton.style.margin = '5px';
      toolbarButton.style.padding = '5px';
      toolbarButton.style.backgroundColor = '#ccc';
      toolbarButton.style.color = 'white';
      toolbarButton.style.border = 'none';
      toolbarButton.style.borderRadius = '5px';
      toolbarButton.style.fontWeight = 'bold';

      toolbarButton.textContent = 'Loading company name...';

      chrome.storage.sync.get("recent_company", function (result) {
        if (result.recent_company) {
          toolbarButton.textContent = `Fill from Chrome Storage: ${result.recent_company}`;
        } else {
          toolbarButton.textContent = 'Fill from Chrome Storage';
        }
      });

      function handleButtonClick() {
        chrome.storage.sync.get(["recent_company", "recent_role"], function (result) {
          if (result.recent_company && result.recent_role) {
            toolbar.querySelector('#company_input_field').value = result.recent_company;
            toolbar.querySelector('#role_input_field').value = result.recent_role;

            let emailSpans = document.querySelectorAll("span[email]");
            if (emailSpans.length > 0) {
              let lastEmailSpan = emailSpans[emailSpans.length - 1];
              let email = lastEmailSpan.getAttribute('email');
              toolbar.querySelector('#company_email_input_field').value = email;
            } else {
              alert('No email span found.');
            }

            autoSubmitAppliedButton();
          } else {
            alert('No recent company or role found in Chrome Storage.');
          }
        });
      }

      toolbarButton.onclick = handleButtonClick;
      toolbar.appendChild(toolbarButton);

      autoSubmitAppliedButton();
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

  const linkToPingojo = document.createElement('a');
  linkToPingojo.setAttribute('href', 'https://pingojo.com/company/' + application.company_slug);
  const pingojoIconUrl = chrome.runtime.getURL('search-pingojo.svg');
  linkToPingojo.innerHTML = '<img style="margin-top:5px;" src="' + pingojoIconUrl + '" alt="View ' + application.company_slug + ' on Pingojo" title="View ' + application.company_slug + ' on Pingojo" height="30px;">';
  buttonContainer.appendChild(linkToPingojo);
}

function setButtonState(toolbar, application) {
  const stageButton = toolbar.querySelector(`#${application.stage_name.toLowerCase()}_button`);

  if (stageButton) {
    if (application.stage_name === 'Applied') {
      stageButton.style.backgroundColor = colors[0];
    } else if (application.stage_name === 'Scheduled') {
      stageButton.style.backgroundColor = colors[1];
    } else if (application.stage_name === 'Next') {
      stageButton.style.backgroundColor = colors[2];
    } else {
      stageButton.style.backgroundColor = colors[3];
    }
    stageButton.style.border = '1px solid #000';
  }
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
      const templateStr = template.toString();
      if (templateStr.startsWith("/Follow up on")) {
        const role = subject.replace("Follow up on ", "").replace(" at " + companyName, "");
        roleInput.value = role;

        let emailSpans = document.querySelectorAll("span[email]");
        if (emailSpans.length > 0) {
          let lastEmailSpan = emailSpans[emailSpans.length - 1];
          let email = lastEmailSpan.getAttribute('email');
          toolbar.querySelector('#company_email_input_field').value = email;
        } else {
          alert('No email span found.');
        }
      }
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

  if (companyName) {
    const linkToPingojo = document.createElement('a');
    linkToPingojo.setAttribute('href', 'https://pingojo.com/?search=' + companyName);
    const pingojoIconUrl = chrome.runtime.getURL('search-pingojo.svg');
    linkToPingojo.innerHTML = '<img style="margin-top:5px;" src="' + pingojoIconUrl + '" alt="Search ' + companyName + ' on Pingojo" title="Search ' + companyName + ' on Pingojo" height="30px;">';
    buttonContainer.appendChild(linkToPingojo);
  }
  const emailContainer = document.querySelector('.h7 [data-legacy-message-id]');

  if (emailContainer) {
    const emailMetaInfo = emailContainer.querySelector('.gE.iv.gt');
    const fromEmailElement = emailMetaInfo.querySelector('.go');
    const fromAddress = fromEmailElement ? fromEmailElement.textContent : '';

    if (fromAddress) {
      var domainName = "";
      const addressParts = fromAddress.replace(/<|>/g, '').split('@');
      if (addressParts.length > 1) {
        const domainParts = addressParts[1].split('.');
        if (domainParts.length > 1) {
          domainName = domainParts.slice(-2).join('.');
        } else {
        }
      } else {
      }

      if (emailMetaInfo.textContent.includes('greenhouse')) {
        const linkToGreenhouse = document.createElement('a');
        linkToGreenhouse.setAttribute('href', 'https://www.google.com/search?q=site:greenhouse.io+' + companyName);
        linkToGreenhouse.textContent = "Search " + companyName + " on Greenhouse";
        buttonContainer.appendChild(linkToGreenhouse);
      }
    }
  }
}

function createLinkToCrm(companyName) {
  const linkToCrm = document.createElement('a');
  if (companyName) {
    linkToCrm.setAttribute('href', 'https://mail.google.com/mail/u/0/#search/"' + companyName + '"');
    const gmailIconUrl = chrome.runtime.getURL('search-mail.svg');
    linkToCrm.innerHTML = '<img style="margin-top:5px; margin-left:10px; margin-right:10px;" src="' + gmailIconUrl + '" alt="Search Gmail" title="Search ' + companyName + ' in Gmail" height="30px;">';
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
  toolbar.style.width = '100%';
  toolbar.style.position = 'relative';

  const inputContainer = document.createElement('div');
  inputContainer.style.display = 'flex';
  inputContainer.style.width = '100%';

  toolbar.appendChild(inputContainer);

  const inputField2 = document.createElement('input');
  inputField2.setAttribute('id', 'company_input_field');
  inputField2.style.marginRight = '10px';
  inputField2.style.width = '50%';
  inputField2.style.marginLeft = '72px';
  inputField2.placeholder = 'Company';
  inputField2.setAttribute('autocomplete', 'off');

  inputContainer.appendChild(inputField2);

  const inputField = document.createElement('input');
  inputField.setAttribute('id', 'role_input_field');
  inputField.style.marginRight = '10px';
  inputField.style.width = '50%';
  inputField.placeholder = 'Role';
  inputContainer.appendChild(inputField);

  const inputFieldEmail = document.createElement('input');
  inputFieldEmail.setAttribute('id', 'company_email_input_field');
  inputFieldEmail.style.marginRight = '10px';
  inputFieldEmail.style.width = '50%';
  inputFieldEmail.placeholder = 'Company Email';
  inputContainer.appendChild(inputFieldEmail);

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

  const checkmarkCount = document.createElement('span');
  checkmarkCount.setAttribute('id', 'checkmark_count');
  checkmarkCount.textContent = '0';
  checkmarkCount.style.display = 'none';
  toolbar.appendChild(checkmarkCount);

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

  chrome.storage.local.get('applications', function (data) {
    let applications = data.applications;

    let companyRolePairs = applications.map(app => [app.company_name, app.job_role, app.stage_name]);

    let uniquePairsSet = new Set();
    companyRolePairs = companyRolePairs.filter(([company, role, stage_name]) => {
      let identifier = `${company}-${role}-${stage_name}`;
      if (!uniquePairsSet.has(identifier)) {
        uniquePairsSet.add(identifier);
        return true;
      }
      return false;
    });

    inputField2.addEventListener('keyup', function (e) {
      const existingAutocomplete = document.getElementById('autocomplete');
      if (existingAutocomplete) existingAutocomplete.remove();

      let autocompleteList = document.createElement('div');
      autocompleteList.setAttribute('id', 'autocomplete');
      autocompleteList.style.position = 'absolute';
      autocompleteList.style.zIndex = '1000';
      autocompleteList.style.left = inputField2.offsetLeft + 'px';
      autocompleteList.style.top = inputField2.offsetTop + inputField2.offsetHeight + 'px';
      autocompleteList.style.width = inputField2.offsetWidth + 'px';
      autocompleteList.style.backgroundColor = '#ffffff';
      autocompleteList.style.border = '1px solid #ccc';
      toolbar.appendChild(autocompleteList);

      const input = e.target.value.toLowerCase();
      const matches = companyRolePairs.filter(([company, role, stage_name]) => company.toLowerCase().includes(input));
      matches.forEach(([company, role, stage_name]) => {
        let option = document.createElement('div');
        option.textContent = `${company} (${role}) - ${stage_name}`;
        option.style.padding = '5px';
        option.addEventListener('mouseover', function () {
          option.style.backgroundColor = '#f0f0f0';
        });
        option.addEventListener('mouseout', function () {
          option.style.backgroundColor = '#fff';
        });
        option.addEventListener('click', function () {
          inputField2.value = company;
          inputField.value = role;
          autocompleteList.remove();
        });
        autocompleteList.appendChild(option);
      });

      document.addEventListener('click', function (event) {
        if (!autocompleteList.contains(event.target)) {
          autocompleteList.remove();
        }
      });
    });
  });

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
    if (isJobPosting("greenhouse")) {
      createOverlay("greenhouse");
    }
  },
  'wellfound.com': function () {
    if (isJobPosting("wellfound")) {
      createOverlay("wellfound");
    }
  },
  'pythoncodingjobs.com': function () {
    if (isJobPosting("pythoncodingjobs")) {
      createOverlay("pythoncodingjobs");
    }
  },
  'applytojob.com': function () {
    if (isJobPosting("applytojob")) {
      createOverlay("applytojob");
    }
  },
  'dice.com': function () {
    if (isJobPosting("dice")) {
      createOverlay("dice");
    }
  },
  'linkedin.com': function () {
    if (isJobPosting("linkedin")) {
      createOverlay("linkedin");
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
          if (!match.includes("u003e")) {
            matches.push(match);
          }
        }
      });
    }
  }

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

function isJobPosting(source) {
  if (source == "greenhouse" || source == "applytojob" || source == "linkedin") {
    const scriptTags = document.getElementsByTagName('script');
    for (const scriptTag of scriptTags) {
      if (scriptTag.type === 'application/ld+json') {
        const data = JSON.parse(scriptTag.textContent);
        if (data['@type'] === 'JobPosting') {
          return true;
        }
      }
    }
  }
  else if (source == "wellfound") {
    const element = document.getElementById("__NEXT_DATA__");
    if (element !== null) {
      return currentURL.includes("/jobs/");
    } else {
      if (currentURL.includes("/jobs/")) {
        const scriptTags = document.getElementsByTagName('script');
        for (const scriptTag of scriptTags) {
          if (scriptTag.type === 'application/ld+json') {
            const data = JSON.parse(scriptTag.textContent);
            if (data['@type'] === 'JobPosting') {
              return true;
            }
          }
        }
      }
    }
  }
  else if (source == "dice") {
    const element = document.getElementById("__NEXT_DATA__");
    if (element !== null) {
      return currentURL.includes("/job-detail/");
    }
  }
  else if (source == "pythoncodingjobs") {
    const element = document.getElementsByClassName("h2 mb-4");

    if (element !== null) {
      if (element[0].textContent == "Job Detail") {
        return currentURL.includes("/jobs/");
      }
    }
  }
  return false;
}

function replaceLinkWithGmailLink() {
  const link = document.querySelector("#stat a");
  if (link) {
    link.parentElement.remove();
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

function extractPythonCodingJobsJobInfo() {
  const jobInfo = {};

  const titleElement = document.querySelector(".col-sm-8 h4");
  const companyElement = document.querySelector(".col-sm-8 .text-muted");

  if (titleElement) {
    jobInfo.title = titleElement.textContent.trim();
  }

  if (companyElement) {
    jobInfo.company = companyElement.textContent.trim();
  }

  const descriptionElement = document.querySelector(".col-lg-12.mb-2-2");

  if (descriptionElement) {
    jobInfo.description = descriptionElement.innerHTML.trim();
  }

  const companyDetailsElements = document.querySelectorAll(".widget .card-body.p-4 ul.list-style5 li");
  companyDetailsElements.forEach((element) => {
    let [key, ...value] = element.textContent.split(' ');
    value = value.join(' ');
    key = 'company' + key.charAt(0).toUpperCase() + key.slice(1).toLowerCase().replace(':', '');
    jobInfo[key] = value.trim();
  });

  if (jobInfo.companyEmail) {
    jobInfo.website = "https://" + jobInfo.companyEmail.split("@")[1];
  }
  return jobInfo;
}

function extractDiceJobInfo() {
  const json_data = document.getElementById("__NEXT_DATA__").textContent;
  jsonObj = JSON.parse(json_data);

  const jobInfo = {};

  jobId = jsonObj.props.pageProps.initialState.djvContext.jobId
  jobData = jsonObj.props.pageProps.initialState.api.queries['getJobById("' + jobId + '")'].data
  jobInfo.link = jobData.detailView.absoluteUrl;

  companyGroupId = jobData.company.groupId;
  jobInfo.company = jsonObj.props.pageProps.initialState.api.queries['getCompanyById({"groupId":' + companyGroupId + ',"isBrandmax":false})'].data.desc

  jobInfo.title = jobData.title;
  jobInfo.datePosted = new Date(jobData.datePosted).toISOString().slice(0, 10);
  jobInfo.description = jobData.description;
  if (jobData.compensationDetail.rawText) {
    if (/\d/.test(jobData.compensationDetail.rawText)) {
      jobInfo.salaryRange = jobData.compensationDetail.rawText;
    }
  }
  jobInfo.companyEmail = jobData.applicationDetail.email

  return jobInfo;
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

function extractWellfoundJobInfoNew() {
  const jobInfo = {};
  const scripts = Array.from(document.getElementsByTagName('script'));

  const jsonLdScript = scripts.find(
    (script) => script.getAttribute('type') === 'application/ld+json' && script.innerHTML.includes('title')
  );

  if (jsonLdScript) {
    const jobData = JSON.parse(jsonLdScript.innerHTML);
    jobInfo.title = jobData.title;
    jobInfo.company = jobData.hiringOrganization.name;
    jobInfo.description = jobData.description;
    jobInfo.datePosted = new Date(jobData.datePosted).toISOString().slice(0, 10);
    jobInfo.validThrough = new Date(jobData.validThrough).toISOString().slice(0, 10);
    jobInfo.employmentType = jobData.employmentType;
    try {
      jobInfo.location = jobData.jobLocation.map(location => location.address.addressLocality + ", " + location.address.addressRegion).join('; ');
    } catch (error) {
      try {
        jobInfo.location = jobData.jobLocation.address.addressLocality + ", " + jobData.jobLocation.address.addressRegion;
      } catch (error) {
      }
    }
    jobInfo.experienceRequirements = jobData.experienceRequirements;
    jobInfo.website = jobData.hiringOrganization.sameAs;
    if (jobData.baseSalary) {
      jobInfo.salaryRange = `$${jobData.baseSalary.value.minValue} - $${jobData.baseSalary.value.maxValue}`;
    }
    jobInfo.perks = jobData.jobBenefits;
    jobInfo.industry = jobData.industry;
    jobInfo.logo = jobData.hiringOrganization.logo;
    jobInfo.image = jobData.image;
    jobInfo.directApply = jobData.directApply;
  }

  return jobInfo;
}

function extractApplyToJobJobInfo() {
  const jobInfo = {};
  const scripts = Array.from(document.getElementsByTagName('script'));

  const jsonLdScript = scripts.find(
    (script) => script.getAttribute('type') === 'application/ld+json' && script.innerHTML.includes('title')
  );

  if (jsonLdScript) {
    const jobData = JSON.parse(jsonLdScript.innerHTML);
    jobInfo.title = jobData.title;
    jobInfo.company = jobData.hiringOrganization.name;
    jobInfo.description = jobData.description;
    jobInfo.datePosted = jobData.datePosted;
    jobInfo.validThrough = jobData.validThrough;
    jobInfo.employmentType = jobData.employmentType;
    jobInfo.location = jobData.jobLocation.address.addressLocality + ", " + jobData.jobLocation.address.addressRegion + " " + jobData.jobLocation.address.postalCode;
    jobInfo.experienceRequirements = jobData.experienceRequirements;
    jobInfo.website = jobData.hiringOrganization.sameAs;
    if (jobData.baseSalary) {
      jobInfo.salaryRange = `${jobData.baseSalary.value.minValue} - ${jobData.baseSalary.value.maxValue}`;
    }
  }

  return jobInfo;
}

function extractLinkedInJobJobInfo() {
  const jobInfo = {};
  const scripts = Array.from(document.getElementsByTagName('script'));

  const jsonLdScript = scripts.find(
    (script) => script.getAttribute('type') === 'application/ld+json' && script.innerHTML.includes('title')
  );

  if (jsonLdScript) {
    const jobData = JSON.parse(jsonLdScript.innerHTML);
    jobInfo.title = jobData.title;
    jobInfo.company = jobData.hiringOrganization.name;
    jobInfo.description = jobData.description;
    jobInfo.datePosted = new Date(jobData.datePosted).toISOString().slice(0, 10);
    jobInfo.validThrough = new Date(jobData.validThrough).toISOString().slice(0, 10);
    jobInfo.employmentType = jobData.employmentType;
    jobInfo.location = (jobData.jobLocation?.address?.addressLocality ?? "") + ", " +
      (jobData.jobLocation?.address?.addressRegion ?? "") + " " +
      (jobData.jobLocation?.address?.postalCode ?? "");
    jobInfo.experienceRequirements = jobData.experienceRequirements;
    if (jobData.baseSalary) {
      jobInfo.salaryRange = `${jobData.baseSalary.value.minValue} - ${jobData.baseSalary.value.maxValue}`;
    } else {
      const bodyContent = document.body.textContent;
      const salaryRangeRegex = /.*?(\$[0-9,]+(?:\.\d{2})?).*?(\$[0-9,]+(?:\.\d{2})?)/;
      const salaryRangeMatch = bodyContent.match(salaryRangeRegex);

      if (salaryRangeMatch) {
        let minSalary = salaryRangeMatch[1].replace(/[$,Kk]/g, '') * 1000;
        let maxSalary = salaryRangeMatch[2].replace(/[$,Kk]/g, '') * 1000;

        jobInfo.salaryRange = `$${minSalary} - $${maxSalary}`;
      }
    }
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

  const logoElement = document.querySelector("#logo a");
  if (logoElement) {
    jobInfo.website = logoElement.href;
  }

  return jobInfo;
}

async function sendJobInfoToBackend(jobInfo) {
  if (!jobInfo.link) {
    jobInfo.link = window.location.href.split("?")[0];
  }

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
                  alert('Network response was not ok 5' + JSON.stringify(response) + JSON.stringify(response.status));
                  throw new Error('Network response was not ok 6', JSON.stringify(response) + JSON.stringify(response.status));
                }
                return response.json();
              }).catch(error => {
                jobInfo.description = "removed jd";
                alert('sendJobInfoToBackend There was a problem with the fetch operation it may be a cors issue -- :' + error + JSON.stringify(jobInfo));
              }).then(data => {
                job_url = data.job_url;
                document.getElementById('pingojo_link_id').href = data.job_url;
                document.getElementById('pingojo_link_id').title = "View on Pingojo";
                document.getElementById('pingojo_link_id').style.display = "block";

                document.getElementById('pingojo_search_company_id').href = "https://www.pingojo.com/?search=" + jobInfo.company;
                document.getElementById('pingojo_search_company_id').title = "Search " + jobInfo.company + " on Pingojo";
                document.getElementById('pingojo_search_company_id').style.display = "block";
              })
              .catch(error => {
                jobInfo.description = "removed jd";
                alert('There was a problem with the data operation -- :' + JSON.stringify(error) + JSON.stringify(jobInfo));
              });
          } else {
            window.location = base_url + '/accounts/login/?from=gmail';
          }
        });
      } else {
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

  if (jobsite === "wellfound") {
    const element = document.getElementById("__NEXT_DATA__");
    if (element !== null) {
      jobInfo = extractWellfoundJobInfo();
    } else {
      jobInfo = extractWellfoundJobInfoNew();
    }
  } else if (jobsite === "greenhouse") {
    jobInfo = extractGreenhouseJobInfo();
  } else if (jobsite === "pythoncodingjobs") {
    jobInfo = extractPythonCodingJobsJobInfo();
  } else if (jobsite === "applytojob") {
    jobInfo = extractApplyToJobJobInfo();
  } else if (jobsite === "dice") {
    jobInfo = extractDiceJobInfo();
  } else if (jobsite === "linkedin") {
    jobInfo = extractLinkedInJobJobInfo();
  }
  const emails = searchElement(document.body);
  const form = document.createElement("form");
  form.id = "job-data-extractor-form";
  overlay.appendChild(form);

  const container = document.createElement("div");
  container.style.display = "flex";

  const pingojoLogoSVG = chrome.runtime.getURL('pingojo-logo.svg');

  const logo = document.createElement("img");
  logo.src = pingojoLogoSVG;
  logo.style.width = "30px";
  logo.style.marginRight = "10px";

  const link = document.createElement("a");
  link.href = "https://pingojo.com/";
  link.id = "pingojo_link_id";
  link.target = "_blank";
  link.appendChild(logo);
  container.appendChild(link);

  const pingojoIconUrl = chrome.runtime.getURL('search-pingojo.svg');

  const pingojoIcon = document.createElement("img");
  pingojoIcon.src = pingojoIconUrl;
  pingojoIcon.style.width = "30px";

  const linkToPingojo = document.createElement("a");
  linkToPingojo.id = "pingojo_search_company_id";
  linkToPingojo.target = "_blank";
  linkToPingojo.appendChild(pingojoIcon);
  container.appendChild(linkToPingojo);

  chrome.storage.sync.get("prompt_text", ({ prompt_text }) => {
    var prompt_text = prompt_text || "Create a cover letter for:";
    const copyToClipboardButton = document.createElement("button");
    copyToClipboardButton.textContent = "GPT";
    copyToClipboardButton.style.marginBottom = "10px";

    const copyToClipboardInput = document.createElement("input");
    copyToClipboardInput.style.display = "none";

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
          copyToClipboardButton.textContent = "GPT ✓";

          chrome.storage.sync.set({ "recent_company": jobInfo.company }, function () {
          });
          chrome.storage.sync.set({ "recent_role": jobInfo.title }, function () {
          });

          window.open("https://chat.openai.com/?temporary-chat=true", "_blank");

        })
        .catch(err => {
          copyToClipboardButton.textContent = "Something went wrong" + err;
        });
    });
    container.appendChild(copyToClipboardButton);
  });

  form.appendChild(container);

  for (const key in jobInfo) {
    const label = document.createElement("label");
    label.htmlFor = `job-data-extractor-${key}`;
    label.textContent = `${key.charAt(0).toUpperCase() + key.slice(1)}:`;
    form.appendChild(label);

    if (key === "website") {
      const anchor = document.createElement("a");
      anchor.href = jobInfo[key];
      anchor.target = "_blank";
      anchor.textContent = jobInfo[key];
      anchor.style.display = "block";
      anchor.style.marginBottom = "10px";

      const favicon = document.createElement("img");
      favicon.src = `https://www.google.com/s2/favicons?domain=${jobInfo[key]}`;
      favicon.style.marginRight = "5px";

      anchor.insertBefore(favicon, anchor.firstChild);
      form.appendChild(anchor);

    } else {
      const input = document.createElement("input");
      input.id = `job-data-extractor-${key}`;
      input.type = "text";
      input.value = jobInfo[key];
      input.style.width = "100%";
      input.style.marginBottom = "10px";
      form.appendChild(input);

      if (key === "title" || key === "company") {
        const copyIcon = document.createElement("span");
        copyIcon.innerHTML = "&#128203;";
        copyIcon.style.cursor = "pointer";
        copyIcon.style.marginLeft = "5px";
        copyIcon.title = "Copy to clipboard";

        copyIcon.addEventListener("click", function () {
          navigator.clipboard.writeText(input.value).then(() => {
          }).catch(err => {
          });
        });

        label.appendChild(copyIcon);
        localStorage.setItem(key, jobInfo[key]);
      }
    }
  }
  const emailsfound = document.createElement("div");
  let updatedEmails = []

  chrome.storage.sync.get("email_address", ({ email_address }) => {
    if (email_address) {
      updatedEmails = emails.filter(email => email !== email_address);
      if (updatedEmails.length > 0) {
        String(updatedEmails).split(',').forEach(email => {
          const emailLink = document.createElement('a');
          emailLink.classList.add('emaillink');
          emailLink.href = `https://mail.google.com/mail/u/0/?view=cm&fs=1&to=${email.trim()}&tf=1`;
          emailLink.target = '_blank';
          emailLink.textContent = email;

          const spacer = document.createTextNode(" ");
          const addLink = document.createElement('a');
          addLink.href = `https://pingojo.com/add_email/?email=${email.trim()}`;
          addLink.target = '_blank';
          addLink.textContent = "+";

          const lineBreak = document.createElement('br');

          emailsfound.appendChild(emailLink);
          emailsfound.appendChild(spacer);
          emailsfound.appendChild(addLink);
          emailsfound.appendChild(lineBreak);

          emailsfound.style.width = "100%";
          emailsfound.style.marginBottom = "10px";
          emailsfound.style.border = "1px solid red";

          form.appendChild(emailsfound);
        });
      }
    }
  });

  const gmailLink = document.createElement("a");
  gmailLink.href = "https://mail.google.com/mail/u/0/#search/" + '"' + jobInfo.company + '"';
  gmailLink.target = "_blank";
  gmailLink.textContent = "Search Gmail for " + jobInfo.company;
  gmailLink.style.display = "block";
  gmailLink.style.marginBottom = "10px";
  form.appendChild(gmailLink);

  if (jobsite === "wellfound") {
    if (jobInfo.website) {
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
  }

  var returned_info = sendJobInfoToBackend(jobInfo);

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
    applicationInfo.textContent = `${application.stage_name} - ${application.job_role} at ${application.company_name}`;

    const followUpButton = document.createElement("button");
    if (application.stage_name != "Passed") {
      followUpButton.textContent = "Follow Up";
      followUpButton.style.marginTop = "10px";
      followUpButton.addEventListener('click', () => handleFollowUpButtonClick(application));

      applicationInfo.appendChild(followUpButton);
    }

    const colors = ['#8bc34a', '#03a9f4', '#ff9800', '#f44336'];

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
  } else {
    const applicationInfo = document.createElement("div");
    applicationInfo.style.marginBottom = "10px";
    applicationInfo.style.padding = "10px";
    applicationInfo.style.border = "1px solid #ccc";
    applicationInfo.style.borderRadius = "5px";
    applicationInfo.style.backgroundColor = "#eee";
    applicationInfo.textContent = `No application found for ${company}`;
    form.appendChild(applicationInfo);
  }
}

// Function to handle the follow-up button click
async function handleFollowUpButtonClick(application) {
  try {
    const email = await fetchEmailFromServer(application.company_name);
    const fullName = localStorage.getItem('full_name');
    openGmailComposeWithEmail(application.company_name, email, application.job_role, fullName);
  } catch (error) {
    console.error('Error fetching email address:', error);
  }
}

// Function to fetch email address from the server
async function fetchEmailFromServer(companyName) {
  var base_url = base_url || "https://www.pingojo.com";
  var full_url = base_url + `/api/get_company_email/?company_name=${encodeURIComponent(companyName)}`;
  const response = await fetch(full_url);
  if (!response.ok) {
    throw new Error('Network response was not ok');
  }
  const data = await response.json();
  return data.email;
}

// Function to open Gmail compose window with prefilled email content
function openGmailComposeWithEmail(companyName, email, jobRole, fullName) {
  const subject = `Follow up on ${jobRole} application at ${companyName}`;
  const body = `Hi ${companyName},\n\nI hope you are doing well. I wanted to follow up on my application for the ${jobRole} role at ${companyName} that I submitted recently. I am very interested in the role and would like to learn more about the opportunity. Please let me know if you have any questions or if there is anything else I can provide.\n\nThanks,\n\n${fullName}`;
  const mailtoLink = `https://mail.google.com/mail/?view=cm&fs=1&to=${email}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.open(mailtoLink, '_blank');
}

for (const site in siteFunctions) {
  if (currentURL.includes(site)) {
    siteFunctions[site]();
    break;
  }
}

const excludedDomains = ["pingojo.com", "google.com", "127.0.0.1", "info@example.com"];

if (!excludedDomains.some(domain => window.location.href.includes(domain))) {
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
    emailList.style.listStyleType = "none";
    chrome.storage.sync.get("email_address", ({ email_address }) => {

      emails.forEach(email => {
        if (!excludedDomains.some(domain => email.includes(domain)) && !email.includes(email_address)) {
          let li = document.createElement("li");

          let mailLink = document.createElement("a");
          mailLink.href = `https://mail.google.com/mail/?view=cm&fs=1&to=${email}`;
          mailLink.target = "_blank";
          mailLink.textContent = email;
          li.appendChild(mailLink);

          let spacer = document.createTextNode(" ");
          li.appendChild(spacer);

          let copyIcon = document.createElement("button");
          copyIcon.textContent = "📋";
          copyIcon.addEventListener("click", (e) => {
            e.preventDefault();
            navigator.clipboard.writeText(email);
            copyIcon.textContent = "📋!";
          });
          li.appendChild(copyIcon);

          let spacer2 = document.createTextNode(" ");
          li.appendChild(spacer2);

          let addLink = document.createElement("a");
          addLink.href = `https://pingojo.com/add_email/?email=${email}`;
          addLink.target = "_blank";
          addLink.textContent = "+";
          li.appendChild(addLink);

          emailList.appendChild(li);
        }
      });

      if (emailList.children.length > 0) {
        newDiv.appendChild(emailList);
        document.body.appendChild(newDiv);
      }
    });
  }
}
