@rem Windows can't execute .mjs files directly, run the fake checker with node
@node "%~dp0fake-tsc.mjs" %*
