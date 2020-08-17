const hostname = '127.0.0.1';
const port = 3000;
const puppeteer = require('puppeteer')
var crypto = require("crypto");
const express = require('express')
const bodyParser = require('body-parser');
const views = require('./views/viewRoutes');
const fs = require('fs');
const dateFormat = require('dateformat');
const { type } = require('os');

const { getDirectoryName, processReport } = require('./helpers')  

var app = express();

app.use('/csp-reports',bodyParser.json({type: 'application/csp-report'}));
app.use('/run-reports', express.urlencoded({extended: true}))
app.use('/trustedTypes-report',bodyParser.json({type: 'application/csp-report'}));

app.use('/csp/*', function(req, res, next){
  res.setHeader('Content-Security-Policy', "object-src 'none';script-src 'nonce-r4nd0m' 'strict-dynamic' https: http:;base-uri 'none'; report-uri /csp-reports");
  next()
})

app.use('/trustedTypes/*', function(req, res, next){
  res.setHeader('Content-Security-Policy', "object-src 'none'; require-trusted-types-for 'script';base-uri 'none'; report-uri /trustedTypes-report");
  next()
})

app.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
});

app.get('/', function(req, res){
    res.sendFile(__dirname + "/views" + "/index.html")
})

app.post('/run-reports', async (req, res) => {
  console.log("start run-reports")
  var id = crypto.randomBytes(20).toString('hex');
  try {
    const browser = await puppeteer.launch();
    const openPage = await browser.newPage();
    const pages = Object.values(req.body).map(e => `http://${hostname}:${port}/${e}?id=${id}`)
    console.log(pages)

    // open report endpoints
    for(const page of pages) {
      await openPage.goto(page, {waitUntil: 'networkidle0'}) // wait for puppeteer to complete fetch
    }
    await browser.close()
  } catch (e) {
    console.log(e)
  }
  console.log("end run-reports")
  // res.sendStatus(204)
  res.redirect('/see-reports?id=' + id);
})

app.get(`/see-reports`, function(req, res) {
  res.sendFile(__dirname + '/views/seeReports.html');
})

app.get(`/process-reports`, function(req,res){
  console.log("start process-reports")

  let directory_name = __dirname + '/reports/' + req.query.id

  //make sure directory exists
  if (!fs.existsSync(directory_name)) {
    throw new Error("Reports directory doesn't exist")
  }

  processedReports = []
  files = fs.readdirSync(directory_name)
  files.forEach(file => {
    let rawdata = fs.readFileSync(directory_name + '/' + file)
    let reportJSON = JSON.parse(rawdata);
    processedReports.push(processReport(reportJSON))
  })

  console.log(processedReports)
  res.send(processedReports)
})

app.post('/csp-reports', function(req, res){
  console.log('CSP violation!')
  console.log(req.body)
  var report = JSON.stringify(req.body)
  // TODO: maybe we should use a url lib instead of this?
  directory_name =__dirname + '/reports/'+ req.body["csp-report"]["document-uri"].split("=")[1]

  // check if directory already exists
  if (!fs.existsSync(directory_name)) {
    fs.mkdir(directory_name,function (err) {
      if (err) {
        return console.log(err);
      }
    });
  }

  file_name = 'csp_' + dateFormat(Date.now(), "dd-mm-yyyy_h:MM:ss") + "_rand" + Math.floor((Math.random() * 5000) + 1) + '.json'
  fs.writeFile(directory_name + '/' + file_name, report, function (err) {
    if (err) {
      return console.log(err);
    }
  });
  res.sendStatus(204)
})

app.post('/trustedTypes-report', function(req, res){
  console.log('Trusted types violation!')
  console.log(req.body)

  var report = JSON.stringify(req.body)
  directory_name =__dirname + '/reports/'+ req.body["csp-report"]["document-uri"].split("=")[1]

  // check if directory already exists
  if (!fs.existsSync(directory_name)) {
    fs.mkdir(directory_name,function (err) {
      if (err) {
        return console.log(err);
      }
    });
  }

  file_name = 'tt_' + dateFormat(Date.now(), "dd-mm-yyyy_h:MM:ss") + "_rand" + Math.floor((Math.random() * 5000) + 1) + '.json'
  fs.writeFile(directory_name + '/' +  file_name, report, function (err) {
    if (err) {
      return console.log(err);
    }
  });
  res.sendStatus(204)
})

app.use('/', views);