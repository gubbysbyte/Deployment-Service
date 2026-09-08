const express = require('express');
const cors = require('cors');
const { generateSlug } = require('random-word-slugs');
const { ECSClient, RunTaskCommand } = require('@aws-sdk/client-ecs');
const dotenv = require('dotenv');

const { Server } = require('socket.io');
const Redis = require('ioredis');

dotenv.config();

const app = express();
const PORT = 9000;

app.use(cors());

const subscriber = new Redis(process.env.REDIS_URL);

const io = new Server({ cors: '*' });
io.on('connection', socket => {
    socket.on('subscribe', channel => {
        socket.join(channel);
        socket.emit('subscribed', channel);
    })
})

io.listen(9001);
console.log('Socket server is running on port 9001');

const ecsClient = new ECSClient({
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    },
    region: 'eu-north-1'
})

const config = {
    CLUSTER: process.env.AWS_CLUSTER_NAME,
    TASK: process.env.AWS_TASK_DEFINITION
}

app.use(express.json());

app.post('/project', async (req, res) => {
    const { gitURL, slug } = req.body;
    
    if(!gitURL){
        return res.status(400).json({error: 'gitURL is required'});
    }

    const projectSlug = slug ? slug : generateSlug();

    // Spin the container
    const command = new RunTaskCommand({
        cluster: config.CLUSTER,
        taskDefinition: config.TASK,
        launchType: 'FARGATE',
        count: 1,
        networkConfiguration: {
            awsvpcConfiguration: {
                subnets: ['subnet-09c1ff3728d9fea8b', 'subnet-0b6344ef630e29386', 'subnet-006cc7e851537ec93'],
                assignPublicIp: 'ENABLED',
                securityGroups: ['sg-0bf218826fcfa545e']
            }
        },
        overrides: {
            containerOverrides: [
                {
                    name: 'builder-image-88',
                    environment: [
                        {
                            name: 'GIT_REPOSITORY__URL',
                            value: gitURL
                        },
                        {
                            name: 'PROJECT_ID',
                            value: projectSlug
                        },
                        {
                            name: 'REDIS_URL',
                            value: process.env.REDIS_URL
                        }
                    ]
                }
            ]
        }
    })

    await ecsClient.send(command);

    return res.json({
        status: 'queued',
        data: {
            projectSlug, 
            url: `http://${projectSlug}.localhost:8000`
        }
    })
})

async function initRedisSubscribe(){
    console.log('Subscribing to Redis channel logs:*');
    subscriber.psubscribe('logs:*')
    subscriber.on('pmessage', (pattern, channel, message) => {
        io.to(channel).emit('message', message);
    })
}

initRedisSubscribe();

app.listen(PORT, () => {
    console.log(`API server is running on port ${PORT}`);
})