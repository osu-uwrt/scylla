import React from "react";

export default class Dashboard extends React.Component
{
    handleSubmit()
    {
        fetch("http://localhost:5000/login");

        /*
        fetch("http://localhost:5000/login", {
            method: "POST",
            body: JSON.stringify(data),
            headers: 
            {
                "Content-Type": "application/json"
            }
        });
        */
    }

    render()
    {
        return (
            <div>
                <button onClick={this.handleSubmit}>Authenticate Into Box</button>
            </div> 
        )
    }    
}