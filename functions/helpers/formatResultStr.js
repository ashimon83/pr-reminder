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
  const emailMap = members.reduce((acc, member) => (
    Object.assign(acc, {
      [member.profile.email]: member.id
    })
  ), {})
  const usersCollection = db.collection('users')
  const pullRequests = data.data.repository.pullRequests.edges
  const targetRepositoryName = `${owner}/${name}`
  const attachedPullRequests = pullRequests.filter(pr => {
    const {reviewRequests} = pr.node
    return reviewRequests.nodes.length > 0
  })
  const pullRequestsCount = attachedPullRequests.length
  const headStr = pullRequestsCount > 0 ? `:octocat: ${pullRequestsCount} waiting pull requests in ${targetRepositoryName} repository
  :eyes: Don't miss it! https://github.com/${targetRepositoryName}/pulls
` : 'NO :pizza: ! :mouse:'
  const resultStr = await attachedPullRequests.reduce(async (acc, pr) => {
    const {author, createdAt, reviewRequests, title, url} = pr.node
    const dateStr = format(createdAt, 'YYYY/MM/DD')
    const reviewerNameList = await Promise.all(reviewRequests.nodes.map(async (node) => {
      const githubName = node.requestedReviewer.login
      const githubEmail = node.requestedReviewer.email
      const mentionNameByEmail = (githubEmail && emailMap[githubEmail] && `<@${emailMap[githubEmail]}>`) || ''
      const userNameDoc = await usersCollection.doc(githubName).get()
      const mentionNameByFireStoreMap = userNameDoc.exists && userNameDoc.data().slack && `<@${nameMap[userNameDoc.data().slack]}>`
      return `${mentionNameByEmail || mentionNameByFireStoreMap || githubName}`
    }))

    const reviewersNameStr = reviewerNameList.map(name => name).join(' & ')
    const str = `:pray: *${author.login}* requests review ${title} to *${reviewersNameStr}* until ${dateStr} ${url}`
    const accSync = await acc
    const prReviewText = `${accSync.text}
${str}
    `
    const reviewerInfo = reviewerNameList.reduce((reviewer, name) => {
      const isExist = reviewer[name] > 0
      return {
        ...reviewer,
        [name]: isExist ? (reviewer[name] + 1) : 1
      }
    }, accSync.reviewer)
    return {
      text: prReviewText,
      reviewer: reviewerInfo
    }
  }, {text: '', reviewer: {}})
  const rankingArray = Object.keys(resultStr.reviewer).map((name) => ({name: name, count: resultStr.reviewer[name]})).sort((a, b) => b.count - a.count)
  const rankingStr = rankingArray.reduce((acc, cur, index) => {
    return `${acc}
    No. ${index + 1}  ${cur.name} keep ${[...Array(cur.count)].map((_, index) => ':pizza:').join('')} requests!`
  }, '*Top :pizza: holders*')
  return `${headStr}${resultStr.text}${rankingStr}`
}
