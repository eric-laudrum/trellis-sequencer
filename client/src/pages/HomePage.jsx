import '../styles/HomePage.css'

export default function HomePage({ onEnterLobby }){

    return(
        <div className={'home-page'}>
            <h3>Welcome to</h3>

            <div className={'logo-container'}>
                <img src={'/src/assets/images/trellis.svg'}/>
            </div>


            <div >
                <p className={'sub-header'}>a collaborative audio sampler</p>
            </div>

            <div className={'lobby-section'}>
                <button
                    className={'lobby-button'}
                    onClick={onEnterLobby}
                >
                    {/*join lobby*/}
                </button>

                <p className={'lobby-message'}>join the lobby</p>
            </div>
        </div>
    )
}