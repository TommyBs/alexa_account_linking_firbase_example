const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();
const uuid4 = require('uuid').v4;
const db = admin.firestore();

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//   functions.logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

async function getUidFromCode(code) {
    let results = await db.collection('codes').where("code","==", code).get()
   
    if(results.empty) {
        return false;
    }
    let doc = results.docs[0];

    let uid = doc.data().uid;
    return uid;
}

async function getUidFromRefreshToken(refresh_token) {
    let results = await db.collection('tokens').where("refresh_token","==", refresh_token).get()
    if(results.empty) {
        return false;
    }
    let doc = results.docs[0];
    let uid = doc.data().uid;
    return uid;
}

async function generateAccessToken(uid) {
    const additionalClaims = {}// add any additional claims you want here, you might want to add that they've permitted alexa for example
    const token = await admin.auth().createCustomToken(uid,additionalClaims)
    return token;
}

async function accessTokenFromAuthCode(req,res) {
   
    let uid = await getUidFromCode(req.body.code);
    if(!uid) {
        return res.status(401).send('')
    }
    const token = await generateAccessToken(uid);

    const refresh_token = uuid4()
    //save the token to our db
    await db.collection('tokens').doc(uid).set({
        access_token:token,
        refresh_token: refresh_token,
        uid:uid
    },{merge:true});
    return res.json({
        access_token: token,
        token_type: "bearer",
        refresh_token: refresh_token,
        expires_in: 1000 * 60 * 60 * 24, // 1 day
    })
}



async function accessTokenFromRefreshToken(req,res) {
    const refresh_token = req.body.refresh_token;
    const uid = getUidFromRefreshToken(refresh_token);

    if(!uid) {
        res.status(401).send('')
    }
    const token = await generateAccessToken(uid);
    await db.collection('tokens').doc(uid).set({
        access_token:token,
        refresh_token: refresh_token,
        uid:uid
    },{merge:true});
    
    return res.json({
        access_token: token,
        token_type: "bearer",
        refresh_token: refresh_token,
        expires_in: 1000 * 60 * 60 * 24, // 1 day
    })

}

exports.access_token = functions.https.onRequest(async (req, res) => {
    // check client_id and client_secret
  
    if (req.body.grant_type === "authorization_code") {
      return  accessTokenFromAuthCode(req, res);
    } else if (req.body.grant_type === "refresh_token") {
      return accessTokenFromRefreshToken(req, res);
    } else {
      return res.status(401).send('');
    }
  });
