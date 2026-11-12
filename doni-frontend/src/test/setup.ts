import { configure } from '@testing-library/dom'

// Page tests render the whole app, whose routes load lazily. When every test
// file runs at once, a route can take more than the default second to load:
// wait longer before deciding an element will not appear.
configure({ asyncUtilTimeout: 5000 })
