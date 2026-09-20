import '../styles/HomePage.css'

export default function HomePage({ onEnterLobby }){

    return(
        <div className={'home-page'}>
            <h3>Welcome to Trellis</h3>

            <div className={'welcome-message'}>
                <p>The Trellis Sequencer is a collaborative audio sampler</p>
            </div>

            <div className={'lobby-section'}>
                <button
                    className={'lobby-button'}
                    onClick={onEnterLobby}
                >
                    join lobby
                </button>
            </div>
        </div>
    )
}