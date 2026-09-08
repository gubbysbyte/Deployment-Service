const {exec} = require('child_process');
const path = require('path');
const fs = require('fs');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const mime = require('mime-types')
const dotenv = require('dotenv');
const Redis = require('ioredis');

dotenv.config();

const publisher = new Redis(process.env.REDIS_URL);

// const s3Client = new S3Client({
//     region:'eu-north-1',
//     credentials: {
//         accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//         secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
//     }
// })

const s3Client = new S3Client({
    region:'eu-north-1'
})

const PROJECT_ID = process.env.PROJECT_ID;

function publishLog(log){
    publisher.publish(`logs:${PROJECT_ID}`, JSON.stringify({log}));
}

async function init(){
    console.log('Executing script.js');
    publishLog('Build Started...');
    const outDirPath = path.join(__dirname, 'output');

    const p = exec(`cd ${outDirPath} && npm install && npm run build`);

    p.stdout.on('data', function(data){
        console.log(data.toString());
        publishLog(data.toString());
    })

    p.stdout.on('error', function(data){
        console.log("Error ", data.toString());
        publishLog("Error " + data.toString());
    })

    p.on('close', async function(code){
        if (code !== 0) {
            console.log(`Build failed with exit code ${code}`);
            publishLog(`Build failed with exit code ${code}`);
            await publisher.quit();
            process.exit(1);
        }

        console.log('Build Complete');
        publishLog('Build Complete');

        const distFolderPath = path.join(__dirname, 'output', 'dist');
        const distFolderContents = fs.readdirSync(distFolderPath, {recursive: true});


        publishLog('Uploading to S3...');
        for(const file of distFolderContents){
            const filePath = path.join(distFolderPath, file);

            if(fs.lstatSync(filePath).isDirectory()) continue;

            console.log(`Uploading ${file} to S3`);
            publishLog(`Uploading ${file} to S3`);

            const command = new PutObjectCommand({
                Bucket: 'deployment-service-outputs',
                Key: `__outputs/${PROJECT_ID}/${file}`,
                Body: fs.createReadStream(filePath),
                ContentType: mime.lookup(filePath)
            })
            await s3Client.send(command);

            publishLog(`Finished uploading ${file}`);
            console.log(`Finished uploading ${file}`);
        }

        publishLog('Upload Complete');
        console.log('Upload Complete');

        await publisher.quit();
        process.exit(0);
    })
}

init();