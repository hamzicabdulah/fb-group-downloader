const Nightmare = require('nightmare');
const nightmare = Nightmare({
    show: true,
    waitTimeout: 10000
});
const fs = require('fs');
const os = require('os');

// There are different chilkat packages for different operating systems
if (os.platform() == 'win32') {
    var chilkat = require('chilkat_node6_win32');
} else if (os.platform() == 'linux') {
    if (os.arch() == 'arm') {
        var chilkat = require('chilkat_node6_arm');
    } else if (os.arch() == 'x86') {
        var chilkat = require('chilkat_node6_linux32');
    } else {
        var chilkat = require('chilkat_node6_linux64');
    }
} else if (os.platform() == 'darwin') {
    var chilkat = require('chilkat_node6_macosx');
}

const http = new chilkat.Http();

const type = process.argv[2];
const email = process.argv[3];
const pass = process.argv[4];
let group = process.argv[5];

if (!type || !email || !pass || !group) {
    console.log('Incorrect usage of command.');
    console.log('Please use this format: "node download <file-type> <fb-email> <fb-password> <fb-group-url>"');
    process.exit(1);
} else if (type !== 'files' && type !== 'photos') {
    console.log('File type can only have the value of "files" and "photos"');
    process.exit(1);
}

// Temporary handler since photos downloader is not yet implemented
if (type === 'photos') {
    console.log('You can currently only download files.');
    process.exit(1);
}

if (group.indexOf(type) >= 0) {
    // In case the user provides the url for the files/photos page instead of the group main page
    group = group.split('/' + type)[0];
} else if (group[group.length - 1] === '/') {
    // If last character of url is "/", remove it
    group = group.slice(0, -1);
}

let groupId = group.split('groups/')[1];

if (!fs.existsSync('groups/')) {
    fs.mkdirSync('groups/');
}
if (!fs.existsSync('groups/' + groupId)) {
    fs.mkdirSync('groups/' + groupId);
}
if (!fs.existsSync('groups/' + groupId + '/' + type)) {
    fs.mkdirSync('groups/' + groupId + '/' + type);
}

console.log('Downloading your files. Please wait.');

nightmare.goto('https://facebook.com')
    .wait('#email')
    .insert('#email', email)
    .insert('#pass', pass)
    .click('[value="Log In"]')
    .wait(1000)
    .goto(group + '/' + type)
    .wait('._2yaa')
    .then(() => {
        loadFullPage(() => {
            nightmare.on('console', (log, msg) => {
                console.log(msg)
            }).evaluate(() => {
                // Click on all options button elements for all files, in order for download buttons to show up in the dom
                document.querySelectorAll('.sx_f2319c').forEach(btn => {
                    btn.click();
                });
                let urls = [];
                document.querySelectorAll('._54nc').forEach((link, index) => {
                    // Collect urls of all files to be downloaded
                    let url = link.href;
                    if (url.indexOf('lookaside') >= 0) urls.push(url);
                });
                return urls;
            }).then(urls => {
                downloadAll(urls, 0, reply => {
                    console.log(reply);
                    nightmare.end();
                    process.exit(1);
                });
            }).catch(() => {
                console.log('Something went wrong. The download links couldn\'t be parsed. Please try again.');
                nightmare.end();
                process.exit(1);
            });
        });
    })
    .catch(() => {
        console.log('Something went wrong. Please double check your credentials and group url.');
        nightmare.end();
        process.exit(1);
    });

function downloadAll(urls, index, cb) {
    if (index >= urls.length) {
        return cb('All downloads completed.');
    }
    download(urls[index], reply => {
        console.log(reply);
        return downloadAll(urls, index + 1, cb);
    });
}

function download(url, cb) {
    let fileName = decodeURI(url.split('file/')[1].split('?token')[0]);
    let fileDest = 'groups/' + groupId + '/' + type + '/' + fileName;
    let success;

    success = http.UnlockComponent(fileName + email.split('@')[0]); // You can enter anything to unlock component
    if (success !== true) {
        console.log(http.LastErrorText);
        return cb('Download of ' + fileName + ' failed.');
    }

    success = http.Download(url, fileDest);
    if (success !== true) {
        console.log(http.LastErrorText);
        return cb('Download of ' + fileName + ' failed.');
    }
    // This should run only if the file is successfully downloaded
    return cb('Download of ' + fileName + ' completed successfully.');
}

function loadFullPage(cb) {
    // Keep loading more files, until all are loaded
    return nightmare.exists('#group_files_pager_' + groupId + ' .uiMorePager')
        .then(moreToLoad => {
            if (moreToLoad) {
                nightmare.click('a.uiMorePagerPrimary')
                    .wait(1500)
                    .then(() => {
                        return loadFullPage(cb);
                    })
                    .catch(() => {
                        console.log('Something went wrong. The page wasn\'t able to load all the files successfully. Please try again.');
                        nightmare.end();
                        process.exit(1);
                    });
            } else {
                return cb();
            }
        })
        .catch(() => {
            console.log('Something went wrong. The page wasn\'t able to load all the files successfully. Please try again.');
            nightmare.end();
            process.exit(1);
        });
}