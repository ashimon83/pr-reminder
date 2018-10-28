const admin = require('firebase-admin')
const functions = require('firebase-functions')
const gql = require('graphql-tag')
const { IncomingWebhook } = require('@slack/client')
const webhook = new IncomingWebhook(functions.config().slack.url)
const {formatResultStr} = require('./helpers/formatResultStr')

admin.initializeApp(functions.config().firebase)
const db = admin.firestore()
db.settings({timestampsInSnapshots: true})

const {key, owner, name} = functions.config().githubapi
const { ApolloClient } = require('apollo-client')
const { HttpLink } = require('apollo-link-http')
const { ApolloLink, concat } = require('apollo-link')
const { InMemoryCache } = require('apollo-cache-inmemory')
const fetch = require('node-fetch')

exports.prReminder = functions.https.onRequest((request, response) => {
  const authMiddleware = new ApolloLink((operation, forward) => {
    operation.setContext({
      headers: {
        Authorization: `bearer ${key}`,
        Accept: 'application/vnd.github.v4.idl'
      }
    })
    return forward(operation)
  })

  const httpLink = new HttpLink({ uri: 'https://api.github.com/graphql', fetch })
  const client = new ApolloClient({
    link: concat(authMiddleware, httpLink),
    cache: new InMemoryCache()
  })

  client
    .query({
      query: gql`{
        repository(owner: "${owner}", name: "${name}") {
          pullRequests(last: 100, states: OPEN) {
            edges {
              node {
                title
                author {
                  login
                }
                number
                mergeable
                createdAt
                url
                reviewRequests(last: 10) {
                  nodes {
                    requestedReviewer {
                      ... on User {
                        login
                        name,
                        email
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
      
      `
    })
    .then(async data => {
      const sendStr = await formatResultStr(data, db, owner, name)
      return webhook.send(sendStr, (err, res) => {
        if (err) {
          response.send(err)
        } else {
          response.send(res)
        }
      })
    })
    .catch(error => {
      console.error(error)
      response.send(error)
    })
})
