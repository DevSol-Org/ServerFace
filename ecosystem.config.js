module.exports = {
    apps: [
        {
            name: "server-app",
            script: "./main.js",
            watch: false,
            max_memory_restart: '1000M',
            instances: "max",
            exec_mode: "cluster",
            cron_restart: "59 23 * * *",
            env: {
                NODE_ENV: "development",
            },
            env_production: {
                NODE_ENV: "production",
                PORT: process.env.PORT || 4010
            }
        }
    ]
};