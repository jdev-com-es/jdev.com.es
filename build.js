import fs from 'fs-extra'
import rimraf from 'rimraf'
import xml2json from 'xml2json'
const asyncRimraf = (path) => new Promise((resolve) => rimraf(path, resolve))

const xmlRaw = await fs.readFile("./src/rss.xml")
const xml = xml2json.toJson(xmlRaw, { object: true })

const packjson = await fs.readJSON('package.json')
const tpls = await fs.readdir(packjson.build.templatesDir)
const templates = {}
tpls.forEach(async f => {
    const content = (await fs.readFile(packjson.build.templatesDir + '/' + f)).toString()
    templates[f.split('.')[0]] = content
})

const dirExists = await fs.pathExists(packjson.build.outputDir)
if (dirExists) await asyncRimraf(packjson.build.outputDir)

await fs.copy(packjson.build.sourceDir, packjson.build.outputDir, { filter: (src, dst) => {
    if (packjson.build.ignore.includes(src.substring(packjson.build.sourceDir.length))) return false
    if (dst.endsWith(".tpl.html")) {
        const content = fs.readFileSync(src).toString()
        const spl = content.split('\n')
        const defhead = spl[0]
        const tplid = defhead.substring(defhead.indexOf('TEMPLATE:')+9).split(' ')[0]
        let finalFile = templates[tplid].replaceAll('<!-- TEMPLATE:CONTENT -->', content)
        let head = 1
        while (spl[head].indexOf('TEMPLATE:OVERWRITE') != -1) {
            const toks = spl[head].substring(spl[head].indexOf('TEMPLATE:OVERWRITE ')+19).split(' ')
            const repl = toks.slice(1, toks.length - 1).join(' ')
            finalFile = finalFile.replaceAll(`<!-- TEMPLATE:DATA ${toks[0]} -->`, repl)
            head++
        }
        finalFile = finalFile.replaceAll('$$relpath$$', dst.substring(packjson.build.outputDir.length + 1).replace('.tpl.html', ''))
        fs.writeFileSync(dst.replaceAll('.tpl.html', '.html'), finalFile)
        return false
    }
    if (dst.endsWith(".post.html")) {
        let content = fs.readFileSync(src).toString()
        const items = Array.isArray(xml.rss.channel.item) ? xml.rss.channel.item : [xml.rss.channel.item]
        const auto_post_gen = items.map(item => `
            <article role="article" class="tbx-card">
                <a href="${item.link}">${item.title}</a>
                <p>${item.description}</p>
            </article>
        `)
        
        content = content.replaceAll('$$auto_post_gen$$', auto_post_gen)
        fs.writeFileSync(dst.replaceAll('.post.html', '.html'), content)
        return false
    }

    return true
}})
