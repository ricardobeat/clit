
window = this; // SHA implementation was written for the browser, lazy workaround

load('helpers.js');
load('underscore.js');
load('sha.js');

// API data
var SECRET = 'UsC17sDqyquzCfSOBMVczRjcTEEcifbB3G5gmSB98';
var KEY = '3aMDHafmoqUfWQRCTHHMtQ';

load('oauth.js');

/* --------------------------- */

var tokens, oauth_data;

function getConfig(){
  var file = new Stream('config.json');
	try {
		tokens = JSON.parse( file.readText() );
		//prettyPrint(tokens);
	} catch(e){
		writeln(ERROR_NODATA);
	};
	
	// set data for OAuth signatures
	oauth_data = {
  	  oauth_token: tokens.oauth_token
  	, oauth_consumer_key: KEY
  	, oauth_nonce: generateNonce()
  	, oauth_timestamp: Math.floor(+new Date()/1000)
  	, oauth_signature_method: 'HMAC-SHA1'
  	, oauth_version: '1.0'
  };
  
};

function oauthRequest(url, params){
  // add parameters to data object
  _.extend(oauth_data, params);
  // create oauth signature
  oauth_data.oauth_signature = HMACSHA1(SECRET+'&'+tokens.oauth_token_secret, signature('GET', url, oauth_data));
  // build request
  if (params){
    url += '?' + serialize(params);
  }
  var oauth = new Stream(url, '1', {
		'Authorization': 'OAuth ' + serializeHeader(oauth_data)
	});
	
	var tweets = JSON.parse(oauth.readText());
	
	if (!tweets.length){
	  write(ERROR_API.red());
	  exit;
	}
	return tweets;
};

/* ----------------- */

// cli methods

clit = {
  // get most recent tweets
  get: function(){
    getConfig();
    
		var tweets = oauthRequest('http://api.twitter.com/1/statuses/home_timeline.json', {
		  count: +args[1] || 10
		});
		
		writeln();
		tweets.forEach(function(tweet,i){				
			writeln(tweet.user.name.yellow(1) + ': ' + tweet.text.white() + '\n' + relativeTime(tweet.created_at).magenta()+'\n');
		});
		
  },
  // show local keys
  data: function(){
    getConfig();
  	prettyPrint( dados );
  },
  // post new tweets
  post: function(){
    
    getConfig();
    
    var text = args.slice(1).join(' ');
		
		var url = 'api.twitter.com/1/statuses/update.json';
		var body = 'status='+txt.replace(/\s/g,'+');
		
		var data = {
			  oauth_token: tokens.oauth_token
			, oauth_consumer_key: KEY
			, oauth_nonce: generateNonce()
			, oauth_timestamp: Math.floor(+new Date()/1000)
			, oauth_signature_method: 'HMAC-SHA1'
			, oauth_version: '1.0'
			, status: encode(txt)
		};
			
		data.oauth_signature = HMACSHA1(SECRET+'&'+tokens.oauth_token_secret, signature('POST','http://api.twitter.com/1/statuses/update.json', data));
		
		var oauth = new Stream('net://api.twitter.com');
		var req = '';
		req += "POST /1/statuses/update.json HTTP/1.1\r\n";
		req += "Host: api.twitter.com\r\n";
		req += "Authorization: OAuth " + serializeHeader(data) + "\r\n";
		req += "Content-Type: application/x-www-form-urlencoded\r\n";
		req += "Content-Length: "+body.replace(/([^\r])\n/g,"$1\r\n").length+"\r\n";
		req += "\r\n";
		req += body;
		
		writeln(req.red())
		
		oauth.write(req);
		
		writeln(oauth.readText().toString().cyan()+colors.reset);
  },
  pin: function(){
    var pin = args[1];
		insertPin(pin);
  },
  authorize: function(){

    var req_token = oauthRequest('http://api.twitter.com/oauth/request_token');
  	var tokens = new Record;
  	req_token.readList(tokens, '&', '=');
  	//writeln(tokens.get('oauth_token'));

  	system.execute('open http://api.twitter.com/oauth/authorize?oauth_token='+tokens.get('oauth_token'));

  	// wait for pin input
  	writeln();
  	writeln('Type your'.green()+' PIN '.yellow()+'to authorize the app:'.green());
  	writeln(colors.bold.magenta);

  	while (true){
  		sleep(100);
  		if (system.kbhit()){
  			pin = system.readln();
  			break;
  		}
  	}

  	var data = {
  		  oauth_token: tokens.get('oauth_token')
  		, oauth_consumer_key: KEY
  		, oauth_nonce: generateNonce()
  		, oauth_timestamp: Math.floor(+new Date()/1000)
  		, oauth_verifier: pin
  		, oauth_signature_method: 'HMAC-SHA1'
  		, oauth_version: '1.0'
  	}

  	data.oauth_signature = HMACSHA1(SECRET+'&'+tokens.get('oauth_token_secret'), signature('GET','http://api.twitter.com/oauth/access_token', data));	

  	oauth = new Stream('http://api.twitter.com/oauth/access_token', '1', {
  		'Authorization': 'OAuth ' + serializeHeader(data)
  	});

  	var tokens = new Record;
  	oauth.readList(tokens, '&', '=');
  	writeln(tokens.toString().cyan());

  	writeln();
  	writeln('Welcome '.white()+tokens.get('screen_name').toString().yellow(1)+'!'+colors.reset);
  	writeln();

  	var file = new Stream('config.json', 'w');
  	file.write( JSON.stringify(tokens.toObject()) );
  }
};

var method = args[0];
if (method && clit[method]) {
  clit[method]();
} else {
  write(ERROR_NOSUCHMETHOD);
}