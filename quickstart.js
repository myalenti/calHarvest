

var fs = require('fs');
var readline = require('readline');
var google = require('googleapis');
var googleAuth = require('google-auth-library');
var config = JSON.parse(fs.readFileSync("config.json")); //Something to stash away for later use
console.log(config.username);

var CalIds = [ 'shawn.Mccarthy@10gen.com', 'michael.lynn@10gen.com'];

var uri = "mongodb+srv://" + config.username + ":" + config.password + "@" + config.repSetName + "/" + config.database;
console.log(uri);
//mongodb+srv://<USERNAME>:<PASSWORD>@calharvest-hm1mt.mongodb.net/test
var dbname = "calendarHarvest";
var collName = "calendarHarvest";
var assert = require('assert');
var MongoClient = require('mongodb').MongoClient;


// If modifying these scopes, delete your previously saved credentials
// at ~/.credentials/calendar-nodejs-quickstart.json
var SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];
var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
    process.env.USERPROFILE) + '/.credentials/';
var TOKEN_PATH = TOKEN_DIR + 'calendar-nodejs-quickstart.json';


// Load client secrets from a local file.
//load the file, then execute callback function processClientSecrets.
fs.readFile('client_secret.json', function processClientSecrets(err, content) {
  if (err) {
    console.log('Error loading client secret file: ' + err);
    return;
  }
  // Authorize a client with the loaded credentials, then call the
  // Google Calendar API.
  //just passing two args to the authorize function
  //paring content allows for reference using dot notation
  //listEvents is the google api action to get actions
  authorize(JSON.parse(content), listEvents);
});


/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  //pulling the secret
  var clientSecret = credentials.installed.client_secret;
  //pulling the clientId
  var clientId = credentials.installed.client_id;
  //pulling the redirectUrl
  var redirectUrl = credentials.installed.redirect_uris[0];

  //create new auth object
  var auth = new googleAuth();
  //create new oauth2client using parameters from file
  var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, function(err, token) {
    if (err) {
      //if we don't get a new token
      getNewToken(oauth2Client, callback);
    } else {
      //if we do, use that token to do the oauth
      oauth2Client.credentials = JSON.parse(token);
      callback(oauth2Client);
    }
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
function getNewToken(oauth2Client, callback) {
  var authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES
  });
  console.log('Authorize this app by visiting this url: ', authUrl);
  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.question('Enter the code from that page here: ', function(code) {
    rl.close();
    oauth2Client.getToken(code, function(err, token) {
      if (err) {
        console.log('Error while trying to retrieve access token', err);
        return;
      }
      oauth2Client.credentials = token;
      storeToken(token);
      callback(oauth2Client);
    });
  });
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(token) {
  try {
    fs.mkdirSync(TOKEN_DIR);
  } catch (err) {
    if (err.code != 'EEXIST') {
      throw err;
    }
  }
  fs.writeFile(TOKEN_PATH, JSON.stringify(token));
  console.log('Token stored to ' + TOKEN_PATH);
}

/**
 * Lists the next 10 events on the user's primary calendar.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function listEvents(auth) {
  var calendar = google.calendar('v3');
for ( var i = 0 ; i < CalIds.length ; i++){
  calendar.events.list({
    auth: auth,
    calendarId: CalIds[i],
    timeMin: (new Date()).toISOString(),
    maxResults: 10,
    singleEvents: true,
    orderBy: 'startTime'
  }, function(err, response) {
    if (err) {
      console.log('The API returned an error: ' + err);
      return;
    }
    var events = response.items;
    if (events.length == 0) {
      console.log('No upcoming events found.');
    } else {
      console.log('Upcoming 10 events:');
      //take the events object and save to MongoDB
      //connect, get a db, get a collection, save to document in collection
      MongoClient.connect(uri, function(err, client){
        if (err) {
          console.log("Something went wrong with the mongoclient");
          console.log(err);
          client.close();
        } else {
          var db = client.db("dbname");
          db.collection(collName, function(err, collection){
            if (err){
              console.log("Opps with getting the collection");
              console.log(err);
              client.close();
            }else{
              collection.insertOne( { "entries" : events}, function(err, result){
                if (err){
                  console.log("Oops with the insertone");
                  console.log(err);
                  console.log(events);
                  client.close();
                }else{
                    console.log("Inserted");
                    console.log(result);
                    client.close();
                };
              });
            };
          });
        };
      });


      for (var i = 0; i < events.length; i++) {
        var event = events[i];
        var start = event.start.dateTime || event.start.date;
        console.log('%s - %s', start, event.summary);
      }
    }
  })};
}
