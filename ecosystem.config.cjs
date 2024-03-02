module.exports = {
  apps: [{
    name: 'igv2-graph-generator',
    script: 'npm',
    args: 'run start',
    watch: true,
    env: {
      NODE_ENV: 'development',
      // other environment variables
    },
    env_production: {
      NODE_ENV: 'production',
      // other environment variables
    }
  }],
};
