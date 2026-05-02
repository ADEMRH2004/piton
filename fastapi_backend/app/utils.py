from fastapi.routing import APIRoute


def simple_generate_unique_route_id(route: APIRoute):
    if route.tags:
        return f"{route.tags[0]}-{route.name}"
    return route.name
