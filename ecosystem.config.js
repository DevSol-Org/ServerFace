module.exports = {
    apps: [
        {
            name: "ServerApp-Face",
            script: "./main.js",
            watch: true,
            max_memory_restart: '1G',
            instances: "max",
            exec_mode: "cluster",
            cron_restart: "59 23 * * *",
            env: {
                NODE_ENV: "production",
                PORT: process.env.PORT || 4010
            }
        }
    ]
};