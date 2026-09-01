const express = require('express');
const { generateSlug } = require('random-word-slugs');
const { ECSClient, RunTaskCommand } = require('@aws-sdk/client-ecs');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = 9000;

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
    const { gitURL } = req.body;
    
    if(!gitURL){
        return res.status(400).json({error: 'gitURL is required'});
    }

    const projectSlug = generateSlug();

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

app.listen(PORT, () => {
    console.log(`API server is running on port ${PORT}`);
})