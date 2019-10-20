// NPM Imports 
import React from 'react';
import { BrowserRouter as Router, Switch, Route } from "react-router-dom";

// Component Imports 
import Dashboard from "./pages/dashboard/Dashboard";
import Authenticated from "./pages/Authenticated";

export default class App extends React.Component 
{
  render()
  {
    return (
      <Router>
        <div>
          <Switch>
            <Route exact path="/">
              <Dashboard />
            </Route>

            <Route exact path="/authenticated">
              <Authenticated />
            </Route>
          </Switch>
        </div>
      </Router>
    );
  }  
}
