# Pull Request Reminder
### environment
- Firebase Functions
- [GraphQL API v4](https://developer.github.com/v4/)
- Some url base schedule execution service like [cron-job.org](https://cron-job.org/en/)

## Setup
### slack
- setting Incoming WebHooks
  - get Webhook URL

### firebase
- make project and set up and...
- read this! https://firebase.google.com/docs/functions/get-started?hl=ja

### cd functions directory
```sh
$ cd functions
```

### install
```sh
 yarn or npm install
```

### Setting github api key and slack hook url
```sh
$ firebase functions:config:set githubapi.key="GITHUB_PERSONAL_ACCESS_TOKEN" githubapi.owner="OWNER_NAME" githubapi.name="REPOSITORY_NAME" slack.url="WEBHOOK_URL"
```

### local test
```sh
$ firebase functions:config:get > .runtimeconfig.json
$ yarn run serve
```

### deploy
```sh
$ yarn run deploy
```

### 