// we can use nginx too
// but we require things dynamically so we will use nodejs as reverse proxy
const express = require('express');
const httpProxy = require('http-proxy');

const app = express();
const PORT = process.env.PORT || 8000;

/*
1. pehle ek module ko install karo {http-proxy}
2. use it to create a proxy server
3. take the hostname and subdomain
4. kaha par jayega ye URL?
    resolvesTo basepath + subdomain, BASE path defined rahega 
5. proxy ko set kardo jisme, target: resolvesTo, changeOrigin: true (matlab jaha se request aayi hai, uske hisab se origin ko change kardo)

now user story
a1.localhost:8000/a1 request aayega, to ye request ko proxy karke a1.localhost:8000 ko forward kar dega
hostname

*/

const BASE_PATH = "https://deployment-service-outputs.s3.eu-north-1.amazonaws.com/__outputs";
const proxy = httpProxy.createProxy();

app.use((req, res) => {
    const hostname = req.hostname; // a1.localhost:8000
    const subdomain = hostname.split('.')[0];

    const resolvesTo = `${BASE_PATH}/${subdomain}`;

    return proxy.web(req, res, {target: resolvesTo, changeOrigin: true})
})

proxy.on('proxyReq', (proxyReq, req, res) => {
    const url = req.url;
    if(url === '/'){
        proxyReq.path += 'index.html';
    }
    return proxyReq;
})

app.listen(PORT, () => {
    console.log(`Reverse proxy server is running on port ${PORT}`)
})