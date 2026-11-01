import '../styles/HomePage.css'

export default function HomePage({ onEnterLobby }){

    return(
        <div className={'home-page'}>
            <div className={'welcome-container'}>

                <h3>Welcome to</h3>

                <div className={'logo-container'}>
                    <img src={'/images/trellis.svg'}/>
                </div>

                <p className={'sub-header'}>a collaborative audio sampler</p>

            </div>


            <div className={'lobby-section'}>
                <button
                    className={'lobby-button'}
                    onClick={onEnterLobby}
                >
                    JOIN
                </button>

            </div>
        </div>
    )
}