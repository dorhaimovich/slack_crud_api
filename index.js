console.log('Loading function');
const AWS = require('aws-sdk');

// Verification
const crypto = require('crypto');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const tName = "SlackCRUD";

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
    if(await isExists(user_id)) {
        console.log("already have a table");
        return false;
    }
    const params = {
        'TableName': 'SlackCRUD',
        'Item': {
            'user_id': user_id ,
            ...attributes
        },
    };

    console.log("the params:\n" + JSON.stringify(params));

    try {
        await dynamodb.put(params).promise();
        console.log("table has been created by user_id:" + user_id);
        return true;
    } catch (err) {
        console.log("Catch" + err);
        return false;
    }
}

async function readRecord(user_id, record_id) {
    if(! await isExists(user_id)) {
        console.log("doesn't have a table");
        return false;
    }
    console.log("user_id " + user_id);
    const queryParams = {
        TableName: 'SlackCRUD',
        FilterExpression: 'user_id = :uid',
        ExpressionAttributeValues: {
            ':uid': user_id
        }
    };

    if(!record_id) {
        try {
            const data = await dynamodb.scan(queryParams).promise();
            return data.Items;
        } catch (err) {
            console.error('Error retrieving records:', err);
            throw err;
        }
    } else {
        const queryParams = {
            TableName: 'SlackCRUD',
            KeyConditionExpression: 'user_id = :uid and record_id = :rid',
            ExpressionAttributeValues: {
                ':uid': user_id,
                ':rid': record_id
            }
        };
        try {
            const data = await dynamodb.query(queryParams).promise();
            return data.Items; // Assuming there is only one record with the given user_id and record_id
        } catch (err) {
            console.error('Error retrieving record:', err);
            throw err;
        }
    }

}




async function handleKey(event) {
    const date = new Date();
    const timestamp = date.getTime().toString();

    let text = event.text;
    let splitValue = text.split("+");
    let firstWord = splitValue[0]; // The first word
    let otherWords = splitValue.slice(1).join(" ");
    console.log("otherwords: " + otherWords);
    firstWord = firstWord.toLowerCase();
    let details;
    let result;
    switch (firstWord) {
        case "create":
            console.log("Handling 'create' key...");
            details = createMessage(firstWord, event.user_name, otherWords);
            return details;
        case "update":
            console.log("Handling 'update' key...");
            // Your code for 'update' here...
            details = createMessage(firstWord, event.user_name, otherWords);
            return details;
        case "read":
            console.log("Handling 'read' key...");
            result = await readRecord(event.user_id, otherWords);
            console.log("result: " + JSON.stringify(result));
            if (!result) {
                details = createMessage(firstWord, event.user_name, "You don't have a table. Create table first");
            } else if (result.length === 0) {
                details = createMessage(firstWord, event.user_name, "This record doesn't exist");
            }
            else {
                details = createMessage(firstWord, event.user_name, result);
            }


            return details;
        case "delete":
            console.log("Handling 'delete' key...");
            details = createMessage(firstWord, event.user_name, otherWords);
            return details;
        case "launch":
            console.log("Handling 'launch' key...");
            const params = {
                'record_id': timestamp,
                'table_name': otherWords,
                'record_data': 'Table created'
            };
            result = await createRecord(tName, event.user_id, params);
            console.log("result: " + result);
            if(result) {
                details = createMessage(firstWord, event.user_name, otherWords);
            } else {
                details = createMessage(firstWord, event.user_name, 'already have a table');
            }

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

// const createMessage = function (command, userName, result ) {
//     const message = {
//         "blocks": [
//             {
//                 "type": "divider"
//             },
//             {
//                 "type": "header",
//                 "text": {
//                     "type": "plain_text",
//                     "text": "Action",
//                     "emoji": true
//                 }
//             },
//             {
//                 "type": "context",
//                 "elements": [
//                     {
//                         "type": "plain_text",
//                         "text": "Author: ",
//                         "emoji": true
//                     }
//                 ]
//             },
//             {
//                 "type": "section",
//                 "text": {
//                     "type": "plain_text",
//                     "text": "Result:",
//                     "emoji": true
//                 }
//             },
//             {
//                 "type": "section",
//                 "text": {
//                     "type": "plain_text",
//                     "text": "dynamic",
//                     "emoji": true
//                 }
//             },
//             {
//                 "type": "divider"
//             }
//         ]
//     };
//     message.blocks[1].text.text = command;
//     message.blocks[2].elements[0].text = "Author: " + userName;
//     message.blocks[4].text.text = result;
//     return message;
// };

const createMessage = function (command, userName, result) {
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
                "type": "divider"
            }
        ]
    };

    message.blocks[1].text.text = command;
    message.blocks[2].elements[0].text = "Author: " + userName;

    // Check if the result is an array
    if (Array.isArray(result)) {
        // Add each JSON object as a separate code block
        result.forEach((item) => {
            const codeBlock = {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": "```\n" + JSON.stringify(item, null, 2) + "\n```"
                }
            };
            message.blocks.push(codeBlock);
        });
    } else {
        // If the result is not an array, add it as a single code block
        const codeBlock = {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": "```\n" + JSON.stringify(result, null, 2) + "\n```"
            }
        };
        message.blocks.push(codeBlock);
    }

    return message;
};


async function isExists(userId) {
    const queryParams = {
        TableName: 'SlackCRUD',
        KeyConditionExpression: 'user_id = :uid',
        ExpressionAttributeValues: {
            ':uid': userId
        }
    };

    return new Promise((resolve, reject) => {
        dynamodb.query(queryParams, function(err, data) {
            if (err) {
                console.error('Error querying records:', err);
                reject(err);
            } else {
                if (data.Items.length === 0) {
                    resolve(false);
                } else {
                    console.log("user items: ", data.Items);
                    resolve(true);
                }
            }
        });
    });
}
