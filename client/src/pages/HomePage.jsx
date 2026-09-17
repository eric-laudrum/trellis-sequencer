import '../styles/HomePage.css'

export default function HomePage(){



    return(
        <div className={'home-page'}>
            <div>Home Page</div>

            <h3>Welcome to Trellis</h3>

            <div className={'welcome-message'}>
                <p>The Trellis Sequencer is a collaborative audio sampler</p>

            </div>

            <div className={'lobby-section'}>
                <button className={'lobby-button'}
                        onClick={()=>{

                        }}

                >
                    lobby
                </button>
            </div>




        </div>

    )
}