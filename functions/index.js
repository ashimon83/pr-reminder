const functions = require('firebase-functions')
const gql = require('graphql-tag')
const { IncomingWebhook } = require('@slack/client')
const webhook = new IncomingWebhook(functions.config().slack.url)
const {format} = require('date-fns')

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
                        name
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
    .then(data => {
      const pullRequests = data.data.repository.pullRequests.edges
      const attachedPullRequests = pullRequests.filter(pr => {
        const {reviewRequests} = pr.node
        return reviewRequests.nodes.length > 0
      })
      const headStr = `:octocat: ${attachedPullRequests.length} waiting pull requests in ${owner}/${name} repository
      :eyes: Don't miss it! https://github.com/${owner}/${name}/pulls
`
      const resultStr = attachedPullRequests.reduce((acc, pr) => {
        const {author, createdAt, reviewRequests, title, url} = pr.node
        const dateStr = format(createdAt, 'YYYY/MM/DD')
        const reviewStr = reviewRequests.nodes.map((node) => `${node.requestedReviewer.login}`).join(' & ')
        const str = `:pray: *${author.login}* requests review ${title} to *${reviewStr}* until ${dateStr} ${url}`
        return `${acc}
${str}
        `
      }, '')
      return webhook.send(`${headStr}${resultStr}`, (err, res) => {
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
