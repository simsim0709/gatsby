const fs = require(`fs-extra`)
const path = require(`path`)
const tmp = require(`tmp-promise`)

const plugin = require(`./plugin`)
const { addPluginToConfig, getPluginsFromConfig } = require(`./plugin`)
const resourceTestHelper = require(`../resource-test-helper`)

const STARTER_BLOG_FIXTURE = path.join(
  __dirname,
  `./fixtures/gatsby-starter-blog`
)
const HELLO_WORLD_FIXTURE = path.join(
  __dirname,
  `./fixtures/gatsby-starter-hello-world`
)
const name = `gatsby-plugin-foo`

describe(`gatsby-plugin resource`, () => {
  let tmpDir
  let starterBlogRoot
  let helloWorldRoot
  let configPath
  beforeAll(async () => {
    tmpDir = await tmp.dir({
      unsafeCleanup: true,
    })
    starterBlogRoot = path.join(tmpDir.path, `gatsby-starter-blog`)
    helloWorldRoot = path.join(tmpDir.path, `gatsby-starter-hello-world`)
    configPath = path.join(helloWorldRoot, `gatsby-config.js`)
    await fs.ensureDir(starterBlogRoot)
    await fs.copy(STARTER_BLOG_FIXTURE, starterBlogRoot)
    await fs.ensureDir(helloWorldRoot)
    await fs.copy(HELLO_WORLD_FIXTURE, helloWorldRoot)
  })
  afterAll(async () => {
    if (tmpDir) {
      await tmpDir.cleanup()
    }
  })

  test(`e2e plugin resource test`, async () => {
    await resourceTestHelper({
      resourceModule: plugin,
      resourceName: `GatsbyPlugin`,
      context: { root: starterBlogRoot },
      initialObject: { id: name, name },
      partialUpdate: { id: name },
    })
  })

  test(`e2e plugin resource test with hello world starter`, async () => {
    await resourceTestHelper({
      resourceModule: plugin,
      resourceName: `GatsbyPlugin`,
      context: { root: helloWorldRoot },
      initialObject: { id: name, name },
      partialUpdate: { id: name },
    })
  })

  test(`does not add the same plugin twice by default`, async () => {
    const configSrc = await fs.readFile(configPath, `utf8`)
    let newConfigSrc = addPluginToConfig(configSrc, {
      name: `gatsby-plugin-react-helmet`,
    })
    newConfigSrc = addPluginToConfig(newConfigSrc, {
      name: `gatsby-plugin-foo`,
    })
    newConfigSrc = addPluginToConfig(newConfigSrc, {
      name: `gatsby-plugin-mdx`,
    })
    const plugins = getPluginsFromConfig(newConfigSrc)
    const plugins1 = [...new Set(plugins)]

    newConfigSrc = addPluginToConfig(newConfigSrc, {
      name: `gatsby-plugin-react-helmet`,
    })

    const plugins2 = getPluginsFromConfig(newConfigSrc)

    expect(plugins1).toEqual(plugins2)
  })

  // A key isn't required for gatsby plugin, but when you want to distinguish
  // between multiple of the same plugin, you can specify it to target config changes.
  test(`validates the gatsby-source-filesystem specifies a key`, async () => {
    const result = plugin.validate({ name: `gatsby-source-filesystem` })

    expect(result.error).toEqual(
      `gatsby-source-filesystem requires a key to be set`
    )
  })

  test(`validates the gatsby-source-filesystem specifies a key that isn't equal to the name`, async () => {
    const result = plugin.validate({
      name: `gatsby-source-filesystem`,
      key: `gatsby-source-filesystem`,
    })

    expect(result.error).toEqual(
      `gatsby-source-filesystem requires a key to be different than the plugin name`
    )
  })

  test(`adds multiple gatsby-source-filesystems and reads with key`, async () => {
    const context = { root: helloWorldRoot }
    const fooPlugin = {
      key: `foo-data-sourcing`,
      name: `gatsby-source-filesystem`,
      options: {
        name: `foo`,
        path: `foo`,
      },
    }
    const barPlugin = {
      key: `bar-data-sourcing`,
      name: `gatsby-source-filesystem`,
      options: {
        name: `bar`,
        path: `bar`,
      },
    }

    await plugin.create(context, fooPlugin)
    await plugin.create(context, barPlugin)

    const barResult = await plugin.read(context, barPlugin.key)
    const fooResult = await plugin.read(context, fooPlugin.key)

    expect(barResult.key).toEqual(barPlugin.key)
    expect(fooResult.key).toEqual(fooPlugin.key)
    expect(barResult.options.name).toEqual(barPlugin.options.name)
    expect(fooResult.options.name).toEqual(fooPlugin.options.name)

    const newBarResult = await plugin.update(context, {
      ...barResult,
      options: { path: `new-bar` },
    })

    expect(newBarResult.key).toEqual(barPlugin.key)
    expect(newBarResult.options).toEqual({ path: `new-bar` })

    await plugin.destroy(context, barResult)
    await plugin.destroy(context, fooResult)
  })

  test(`handles config options as an object`, async () => {
    const configSrc = await fs.readFile(configPath, `utf8`)
    const newConfigSrc = addPluginToConfig(configSrc, {
      name: `gatsby-plugin-foo`,
      options: {
        foo: 1,
        bar: `baz`,
        baz: `qux`,
        otherStuff: [
          {
            foo: `bar2`,
            bar: [{ foo: `bar` }],
          },
        ],
      },
    })

    const result = getPluginsFromConfig(newConfigSrc)

    expect(result).toMatchSnapshot()
  })
})
