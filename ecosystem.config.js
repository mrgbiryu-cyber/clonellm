module.exports = {
  apps: [
    {
      name: "clonellm",
      script: "server.js",
      cwd: "/home/mrgbiryu/clonellm",
      instances: 1,
      exec_mode: "fork",
      env_file: "/home/mrgbiryu/clonellm/.env",
    },
  ],
};
