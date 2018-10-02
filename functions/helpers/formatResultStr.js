const functions = require('firebase-functions')
const {format} = require('date-fns')
const {WebClient} = require('@slack/client')
const token = functions.config().slack.token
const web = new WebClient(token)

exports.formatResultStr = async (data, db, owner, name) => {
  const usersList = await web.users.list({token})
  const {members} = usersList
  const nameMap = members.reduce((acc, member) => (
    Object.assign(acc, {
      [member.name]: member.id
    })
  ), {})
  const usersCollection = db.collection('users')
  const pullRequests = data.data.repository.pullRequests.edges
  const targetRepositoryName = `${owner}/${name}`
  const attachedPullRequests = pullRequests.filter(pr => {
    const {reviewRequests} = pr.node
    return reviewRequests.nodes.length > 0
  })
  const headStr = `:octocat: ${attachedPullRequests.length} waiting pull requests in ${targetRepositoryName} repository
  :eyes: Don't miss it! https://github.com/${targetRepositoryName}/pulls
`
  const resultStr = await attachedPullRequests.reduce(async (acc, pr) => {
    const {author, createdAt, reviewRequests, title, url} = pr.node
    const dateStr = format(createdAt, 'YYYY/MM/DD')
    const reviewStrResults = await Promise.all(reviewRequests.nodes.map(async (node) => {
      const githubName = node.requestedReviewer.login
      const userNameDoc = await usersCollection.doc(githubName).get()
      const slackName = userNameDoc.exists ? `<@${nameMap[userNameDoc.data().slack]}>` : ''
      return `${slackName || githubName}`
    }))

    const reviewStr = reviewStrResults.map(name => name).join(' & ')
    const str = `:pray: *${author.login}* requests review ${title} to *${reviewStr}* until ${dateStr} ${url}`
    const accSync = await acc
    return `${accSync}
${str}
    `
  }, '')
  return `${headStr}${resultStr}`
}
