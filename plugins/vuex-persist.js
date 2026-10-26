import VuexPersistence from "vuex-persist"

// Keep saved collections/environments/settings and the last request, but keep
// credentials and large editor buffers out of localStorage. Saved collection
// requests may still contain auth values the user explicitly stored.
const reducer = state => {
  const request = { ...state.request }
  delete request.httpUser
  delete request.httpPassword
  delete request.bearerToken
  delete request.headers
  return {
    postwoman: state.postwoman,
    theme: state.theme,
    request,
    gql: {
      url: state.gql.url,
      query: state.gql.query,
      variablesJSONString: state.gql.variablesJSONString,
    },
  }
}

export default ({ store }) => {
  new VuexPersistence({
    key: "vuex",
    storage: window.localStorage,
    reducer,
  }).plugin(store)
}
