console.log('Loading function');
const AWS = require('aws-sdk');

// Verification
const crypto = require('crypto');

const dynamodb = new AWS.DynamoDB();
const tName = "CrudAPI";

exports.handler = async (event, context) => {

    console.log("event:" + JSON.stringify(event));
    console.log("context:" + JSON.stringify(context));
    const json = {};
    let data = event.body;
    console.log("data:\n " + data);
    let decodedString = Buffer.from(data, 'base64').toString('utf-8');
    console.log("decode data:\n " + decodedString);
    decodedString.split('&').forEach(pair => {
        const [key, value] = pair.split('=');
        json[key] = decodeURIComponent(value);
    });

    const jsonStringify = JSON.stringify(json, null, 2);
    const jsonObj = JSON.parse(jsonStringify);

    const isAuth = signedBySlack(event, decodedString);
    console.log("Auth: " + isAuth);
    if(!isAuth) {
        return "Not Auth";
    }
    const message = handleKey(jsonObj);
    const message2 = JSON.stringify(message);
    console.log("the message is:\n" + message2);
    return message;
    // throw new Error('Something went wrong');
};

async function createRecord(tableName, user_id, attributes) {
    const params = {
        'TableName': tableName,
        'Item': {
            'user_id': { S: user_id },
            ...attributes
        },
    };

    try {
        await dynamodb.putItem(params).promise();
        console.log('Record created successfully');
        return true;
    } catch (error) {
        console.error('Error creating record:', error);
        return false;
    }
}




function handleKey(event) {
    let text = event.text;
    let splitValue = text.split("+");
    let firstWord = splitValue[0]; // The first word
    let otherWords = splitValue.slice(1).join(" ");
    firstWord = firstWord.toLowerCase();
    let details;
    switch (firstWord) {
        case "create":
            console.log("Handling 'create' key...");
            const params = {
                TableName: tName,
                Item: {
                    'user_id': { S: event.user_id },
                    'record_id': {S: '1'},
                    'table_name': { S: otherWords},
                    'record_data': { S: 'Table created'}
                },
            };
            details = createMessage(firstWord, event.user_name, otherWords);
            return details;
        case "update":
            console.log("Handling 'update' key...");
            // Your code for 'update' here...
            details = createMessage(firstWord, event.user_name, otherWords);
            return details;
        case "read":
            console.log("Handling 'read' key...");
            details = createMessage(firstWord, event.user_name, otherWords);
            return details;
        case "delete":
            console.log("Handling 'delete' key...");
            details = createMessage(firstWord, event.user_name, otherWords);
            return details;
        case "launch":
            console.log("Handling 'launch' key...");
            details = createMessage(firstWord, event.user_name, otherWords);
            return details;
        default:
            console.log(`Invalid key: ${firstWord}`);
            details = createMessage(`Invalid key: ${firstWord}`, event.user_name, otherWords);
            return details;
    }
}
// Validate request is signed by Slack
const signedBySlack = function(req, body) {
    const signature = req.headers['x-slack-signature'];
    console.info('Slack Signature: ', signature);
    const timestamp = req.headers['x-slack-request-timestamp'];
    console.info('Slack Timestamp: ', timestamp);
    const hmac = crypto.createHmac('sha256', process.env.SLACK_SIGNING_SECRET);
    const [version, hash] = signature.split('=');
    hmac.update(`${version}:${timestamp}:${body}`);
    const hmacBuffer = Buffer.from(hmac.digest('hex'),'utf8');
    const hashBuffer = Buffer.from(hash,'utf8');
    console.info('HMAC Buffer: ', hmacBuffer);
    console.info('HASH Buffer: ', hashBuffer);
    const cryptoEquality = crypto.timingSafeEqual(hmacBuffer, hashBuffer);
    console.info('Equal?', cryptoEquality);
    return cryptoEquality;
};

const createMessage = function (command, userName, result ) {
    const message = {
        "blocks": [
            {
                "type": "divider"
            },
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "Action",
                    "emoji": true
                }
            },
            {
                "type": "context",
                "elements": [
                    {
                        "type": "plain_text",
                        "text": "Author: ",
                        "emoji": true
                    }
                ]
            },
            {
                "type": "section",
                "text": {
                    "type": "plain_text",
                    "text": "Result:",
                    "emoji": true
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "plain_text",
                    "text": "dynamic",
                    "emoji": true
                }
            },
            {
                "type": "divider"
            }
        ]
    };
    message.blocks[1].text.text = command;
    message.blocks[2].elements[0].text = "Author: " + userName;
    message.blocks[4].text.text = result;
    return message;
};
