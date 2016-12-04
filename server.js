var express = require('express');
var cookie = require('cookie')
var cookieParser = require('cookie-parser');
var expressSession = require('express-session');
var bodyParser = require('body-parser');

var app = express();
var assert = require('assert');
var mongourl = 'mongodb://student:password@ds159737.mlab.com:59737/testing';
var MongoClient = require('mongodb').MongoClient;
var ObjectId = require('mongodb').ObjectID;
var fileUpload = require('express-fileupload');
var mongoose = require('mongoose');

app = express();

// middlewares
app.use(expressSession({
	secret:'for_testing',
	rolling: false,
	resave: true,
	saveUninitialized:true,
	cookie: {path: '/', maxAge: 3600000, username:null, authenticated:false }
	})
)

var users = new Array(
	{name: 'developer', password: 'developer'},
	{name: 'guest', password: 'guest'},
	{name: 'demo', password: '123'}
);

app.set('view engine','ejs');
app.set('views','./views');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));

app.get('/',function(req,res) {
	if (req.session.authenticated) {
		res.redirect('./list');
		res.end();
	} else {
		res.redirect('/login');
		
	}
});


app.get('/login',function(req,res) {
	res.sendFile(__dirname + '/public/login.html');
});

app.post('/login',function(req,res) {
	for (var i=0; i<users.length; i++) {
		if (users[i].name == req.body.name &&
		    users[i].password == req.body.password) {
			req.session.authenticated=true;
			req.session.username = users[i].name;
			req.session.save(function(err) {});
			res.redirect('/list');
		}
	}

	res.redirect('/');
});

app.get('/register', function(req,res) {
	res.sendFile(__dirname + '/public/register.html');
});

app.post('/register', function(req,res) {
	// handel adding new account
	var newUser = {};  // new user to be inserted
	newUser['userid'] = req.body.userid;
	newUser['password'] = req.body.password;
		//
	MongoClient.connect(mongourl, function(err, db) {
		assert.equal(err,null);
		console.log('Connected to MongoDB\n');
		db.collection('users').insertOne(newUser,
			function(err,result) {
				assert.equal(err,null);
				console.log("insertOne() was successful");
				db.close();
				console.log('Disconnected from MongoDB\n');
				res.writeHead(200, {"Content-Type": "text/plain"});
				res.end('Insert was successful ');
			});
	});
	//res.redirect('/list');
});

app.get('/addRestaurant', function(req,res) {
	res.sendFile(__dirname + '/public/addRestaurant.html');
});

app.use(fileUpload());
app.use(bodyParser.json());

app.post('/addRestaurant', function(req,res) {
	// handel adding new restaurant
	var newRestaurant = {};  // new restaurant to be inserted
	newRestaurant['name'] = req.body.name;
	newRestaurant['address'] = {};
	newRestaurant.address.street = (req.body.street != null) ? req.body.street : null;
	newRestaurant.address.zipcode = (req.body.zipcode != null) ? req.body.zipcode : null;
	newRestaurant.address.building = (req.body.building != null) ? req.body.building : null;
	
	newRestaurant.address['coord'] = [];
	newRestaurant.address.coord.push(req.body.lon);
	newRestaurant.address.coord.push(req.body.lat);
	
	newRestaurant['borough'] = (req.body.borough != null) ? req.body.borough : null;
	newRestaurant['cuisine'] = (req.body.cuisine != null) ? req.body.cuisine : null;
	newRestaurant['restaurant_id'] = (req.body.restaurant_id != null) ? req.body.restaurant_id : null;
	
	var sampleFile;

    if (!req.files) {
        res.send('No files were uploaded.');
        return;
    }
	var bfile;
	bfile=req.files.sampleFile;
	newRestaurant['photo'] = {};
	newRestaurant.photo.data = new Buffer(bfile.data).toString('base64');
	newRestaurant.photo.mimetype = bfile.mimetype;
	
	//newRestaurant['owner']=req.session.username;
		//
	MongoClient.connect(mongourl, function(err, db) {
		assert.equal(err,null);
		console.log('Connected to MongoDB\n');
		db.collection('restaurants').insertOne(newRestaurant,
			function(err,result) {
				assert.equal(err,null);
				console.log("insertOne() was successful");
				db.close();
				console.log('Disconnected from MongoDB\n');
				res.writeHead(200, {"Content-Type": "text/plain"});
				res.end('Insert was successful ');
			});
	});
	//res.redirect('/list');
});

app.get('/list', function(req,res) {
	MongoClient.connect(mongourl, function(err, db) {
		assert.equal(err,null);
		console.log('Connected to MongoDB\n');
		findNRes(db,function(restaurants) {
			db.close();
			console.log('Disconnected MongoDB\n');
			res.render('list',{c:restaurants});
			//res.end();
		});
	});
});

function findNRes(db,callback) {
		var restaurants = [];
		db.collection('restaurants').find(function(err,result) {
			assert.equal(err,null);
			result.each(function(err,doc) {
				if (doc != null) {
					restaurants.push(doc);
				} else {
					callback(restaurants);
				}
			});
		})
}

app.get("/showdetail", function(req,res) {
    MongoClient.connect(mongourl, function(err, db) {
	    assert.equal(err,null);
	    console.log('Connected to MongoDB\n');
	    var criteria = {'restaurant_id':req.query.id};
	    find1Res(db,criteria,function(restaurants) {
	      db.close();
	      console.log('Disconnected MongoDB\n');
        res.render('details',{c:restaurants,lat:restaurants.address.coord[1],lon:restaurants.address.coord[0],zoom:18});
        res.end();
	    });
	  });
});
function find1Res(db,criteria,callback) {
    db.collection('restaurants').findOne(criteria,function(err,result) {
        assert.equal(err,null);
        callback(result);
    });
}

app.get('/logout',function(req,res) {
	req.session = null;
	res.redirect('/');
})
;


var apiSchema = new mongoose.Schema({
  name: {type: String},
  address:{
	street: {type: String},
	zipcode: {type: String},
	building: {type: String},
	coord:[{type: String}],
  },
	  
	borough:{type: String},
	cuisine:{type: String},
	restaurant_id:{type: String},
},
     { collection: 'restaurants' }
);

var apiModel = mongoose.model('api', apiSchema);

app.get('/api/read/getAll', function(req,res){
	mongoose.connect(mongourl, function(err, db) {
		console.log('Connected to Mongoose\n');
		apiModel.find({}, function(err, result) {
			if (err) throw err;
			res.json(result);
		});	
		console.log('Disconnected Mongoose\n');
	});
});


app.get('/api/read/name/:n', function(req,res){
	mongoose.connect(mongourl, function(err, db) {
		console.log('Connected to Mongoose\n');
		apiModel.find({ name: req.params.n }, function(err, result) {
			if (err) throw err;
			res.json(result);
		});	
		console.log('Disconnected Mongoose\n');
	});
});

app.get('/api/read/borough/:b', function(req,res){
	mongoose.connect(mongourl, function(err, db) {
		console.log('Connected to Mongoose\n');
		apiModel.find({ borough: req.params.b }, function(err, result) {
			if (err) throw err;
			res.json(result);
		});	
		console.log('Disconnected Mongoose\n');
	});
});

app.get('/api/read/cuisine/:c', function(req,res){
	mongoose.connect(mongourl, function(err, db) {
		console.log('Connected to Mongoose\n');
		apiModel.find({  cuisine: req.params.c  }, function(err, result) {
			if (err) throw err;
			res.json(result);
		});	
		console.log('Disconnected Mongoose\n');
	});
});


app.post('/api/create', function(req, res) {
    var newRes = req.body;
    MongoClient.connect(mongourl, function(err, db) {
    db.collection('restaurants', function(err, collection) {
        collection.insert(req, function(err, res) {
            if (err) {
                res.json({status: 'failed'});
            } else {
                res.json({status: 'ok'});
            }
        });
    });
  });
});

app.use(function(req, res, next){
   res.status(404);
   res.json({ error: 'Invalid URL' });
});

app.listen(process.env.PORT || 8099);

