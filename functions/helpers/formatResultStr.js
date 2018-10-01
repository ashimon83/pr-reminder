const {format} = require('date-fns')

exports.formatResultStr = async (data, db, owner, name) => {
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
      const slackName = userNameDoc.exists ? `<@${userNameDoc.data().slack}>` : ''
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
