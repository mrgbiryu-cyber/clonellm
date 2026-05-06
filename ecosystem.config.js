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
    {
      name: "openwebui",
      script: "/home/mrgbiryu/.local/bin/uvx",
      args: "--python 3.11 open-webui@latest serve --host 127.0.0.1 --port 8080",
      cwd: "/home/mrgbiryu",
      instances: 1,
      exec_mode: "fork",
      env_file: "/home/mrgbiryu/open-webui.env",
      env: {
      },
    },
    {
      name: "openwebui-public-proxy",
      script: "scripts/openwebui-public-proxy.mjs",
      cwd: "/home/mrgbiryu/clonellm",
      instances: 1,
      exec_mode: "fork",
      env: {
        PUBLIC_PROXY_HOST: "0.0.0.0",
        PUBLIC_PROXY_PORT: "3000",
        PUBLIC_BRAND_NAME: "CNS Atlas",
        OPENWEBUI_TARGET: "http://127.0.0.1:8080",
        CLONELLM_TARGET: "http://127.0.0.1:3100",
      },
    },
  ],
};
