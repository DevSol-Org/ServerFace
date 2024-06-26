module.exports = {
    apps: [
        {
            name: "App-Face",
            script: "./main.js",
            watch: true,
            max_memory_restart: '4G',
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